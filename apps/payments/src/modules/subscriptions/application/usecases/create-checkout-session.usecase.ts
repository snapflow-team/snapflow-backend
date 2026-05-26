import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StripeService } from '../services/stripe.service';
import { Notification } from '../../../../common/notification/notification';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import {
  BusinessRulesSettings,
  Plan,
} from '../../../../setup/configuration/business-rules-settings';
import { CreateCheckoutSessionApplicationDto } from '../dto/create-checkout-session.application-dto';
import { StripeCheckoutSessionResult } from '../types/stripe-checkout-session-result.type';
import { SubscriptionsRepository } from '../../infrastructure/subscriptions.repository';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { CustomersRepository } from '../../infrastructure/customers.repository';
import { Customer, Subscription, SubscriptionStatus } from '@generated/prisma-payments';
import { PrismaService } from '../../../database/prisma.service';
import { CreateCheckoutSessionDto } from '../services/types/create-checkout-session.dto';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { extractStripeCustomerId } from '../webhook/handlers/utils/extract-stripe-customer-id';
import { PaymentsRepository } from '../../infrastructure/payments.repository';
import { StripeCSModes } from '../services/types/stripe-checkout-session-modes.enum';

export class CreateCheckoutSessionCommand {
  constructor(public readonly dto: CreateCheckoutSessionApplicationDto) {}
}

@CommandHandler(CreateCheckoutSessionCommand)
export class CreateCheckoutSessionUseCase
  implements ICommandHandler<CreateCheckoutSessionCommand, Notification<string>>
{
  private readonly logger: ContextLogger;
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
    private readonly paymentsRepository: PaymentsRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(CreateCheckoutSessionUseCase.name);
  }

  async execute({
    dto: { userId, planId },
  }: CreateCheckoutSessionCommand): Promise<Notification<string>> {
    const businessRules: BusinessRulesSettings =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings');

    const plan: Plan | undefined = businessRules.getPlans().find((plan) => plan.id === planId);

    if (!plan) {
      const notification: Notification<string> = Notification.fail<string>(
        NotificationResultCode.BadRequest,
        'Failed to initiate payment for the order',
      );

      notification.addExtension(
        'planId',
        `The selected tariff plan "${planId}" no exists in the system`,
      );

      return notification;
    }

    const localSubscription = await this.subscriptionsRepository.findLastByUserId(userId);

    if (!localSubscription) {
      this.logger.debug(`now we processing not created subscription yet`, this.execute.name);

      return this.createNewSubscription(userId, plan);
    }

    switch (localSubscription.status) {
      case SubscriptionStatus.ACTIVE: {
        return this.extendSubscription(userId, plan, localSubscription);
      }

      case SubscriptionStatus.PENDING:
      case SubscriptionStatus.PAST_DUE: {
        return Notification.fail<string>(
          NotificationResultCode.BadRequest,
          'Failed to extend subscription for user with PAST_DUE or PENDING subscription status. User have to pay for his previous debt',
        );
      }

      case SubscriptionStatus.CANCELLED: {
        return this.createNewSubscription(userId, plan);
      }
    }
  }

  private async createNewSubscription(userId: number, plan: Plan) {
    const customer: Customer | null = await this.customersRepository.findByUserId(userId);

    const stripeCusId: string | undefined = extractStripeCustomerId(customer);

    const dto: CreateCheckoutSessionDto = {
      planId: plan.id,
      mode: StripeCSModes.Subscription,
      userId,
      stripePriceId: plan.stripeSubscriptionPriceId,
      stripeCusId: stripeCusId,
      subscriptionDurationInDays: plan.subscriptionDurationInDays,
    };

    const stripeResult = await this.stripeService.createCheckoutSession(dto);

    if (stripeResult.hasErrors)
      return Notification.copyErrors<StripeCheckoutSessionResult, string>(stripeResult);

    try {
      await this.prisma.$transaction(async (tx) => {
        const createdCustomer = await this.customersRepository.createPendingCustomer(userId, tx);

        await this.subscriptionsRepository.createPendingOrder(
          {
            customerId: createdCustomer.id,
            planId: plan.id,
            amount: plan.priceInCents,
            externalId: stripeResult.value.sessionId,
          },
          tx,
        );
      });
    } catch {
      this.logger.warn(
        `Saving to db checkout session with id ${stripeResult.value.sessionId} FAILED`,
        this.execute.name,
      );

      return Notification.fail<string>(
        NotificationResultCode.InternalServerError,
        'Some error occurred',
      );
    }

    return Notification.ok<string>(stripeResult.value.url);
  }

  private async extendSubscription(userId: number, plan: Plan, activeSubscription: Subscription) {
    this.logger.debug(
      `now we processing extending subscription flow in createCheckoutSessionUseCase`,
      this.extendSubscription.name,
    );

    const customer: Customer | null = await this.customersRepository.findByUserId(userId);

    const stripeCusId: string | undefined = extractStripeCustomerId(customer);

    //Если у нас подписка в ожидании, то есть stripeSubId еще не инициализирован, и эта подписка уже была оформлена, то внутренний рассинхрон
    if (!activeSubscription.stripeSubId) {
      this.logger.warn(
        `Trying to extend pending subscription ${activeSubscription.id}`,
        this.extendSubscription.name,
      );

      return Notification.fail<string>(
        NotificationResultCode.InternalServerError,
        'Some error occurred',
      );
    }

    //Если у нас нет покупателя или он в состоянии pending, то внутренний рассинхрон
    if (!customer || !stripeCusId) {
      this.logger.warn(
        `Trying to extend subscription ${activeSubscription.id} for pending or unexisting customer `,
        this.extendSubscription.name,
      );

      return Notification.fail<string>(
        NotificationResultCode.InternalServerError,
        'Some error occurred',
      );
    }

    const dto: CreateCheckoutSessionDto = {
      planId: plan.id,
      mode: StripeCSModes.Payment,
      userId,
      stripePriceId: plan.stripeOnePayPriceId,
      stripeCusId: stripeCusId,
      subscriptionDurationInDays: plan.subscriptionDurationInDays,
      extendingSubscriptionId: activeSubscription.stripeSubId,
    };

    const stripeResult = await this.stripeService.createCheckoutSession(dto);

    if (stripeResult.hasErrors)
      return Notification.copyErrors<StripeCheckoutSessionResult, string>(stripeResult);

    try {
      await this.paymentsRepository.createPendingPayment({
        subscriptionId: activeSubscription.id,
        plan: plan,
        externalId: stripeResult.value.sessionId,
      });

      this.logger.debug(
        `external id in extend subscription ${stripeResult.value.sessionId}`,
        this.extendSubscription.name,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Some error occurred';

      this.logger.warn(
        `Saving new checkout session with id ${stripeResult.value.sessionId} in local db failed`,
        this.extendSubscription.name,
      );

      return Notification.fail<string>(NotificationResultCode.InternalServerError, errorMessage);
    }

    return Notification.ok<string>(stripeResult.value.url);
  }
}
