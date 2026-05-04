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
import { Customer } from '@generated/prisma-payments';
import { PrismaService } from '../../../database/prisma.service';
import { CreateCheckoutSessionDto } from '../services/types/create-checkout-session.dto';
import { Logger } from '@nestjs/common';
import { extractStripeCustomerId } from '../utils/extract-stripe-customer-id';
import { StripeCSModes } from '../services/types/stripe-checkout-session-modes.enum';
import { PaymentsRepository } from '../../infrastructure/payments.repository';

export class CreateCheckoutSessionCommand {
  constructor(public readonly dto: CreateCheckoutSessionApplicationDto) {}
}

@CommandHandler(CreateCheckoutSessionCommand)
export class CreateCheckoutSessionUseCase
  implements ICommandHandler<CreateCheckoutSessionCommand, Notification<string>>
{
  private readonly logger = new Logger(CreateCheckoutSessionUseCase.name);
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
    private readonly paymentsRepository: PaymentsRepository,
  ) {}

  async execute({
    dto: { userId, planId },
  }: CreateCheckoutSessionCommand): Promise<Notification<string>> {
    const businessRules: BusinessRulesSettings =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings');
    const plan: Plan | undefined = businessRules.plans.find((p) => p.id === planId);

    if (!plan) {
      const notification: Notification<string> = Notification.fail<string>(
        NotificationResultCode.BadRequest,
        'Failed to initiate payment for the order',
      );

      notification.addExtension(
        'planId',
        `The selected tariff plan "${planId}" no longer exists in the system`,
      );

      return notification;
    }

    const customer: Customer | null = await this.customersRepository.findByUserId(userId);

    const stripeCusId: string | undefined = extractStripeCustomerId(customer);

    const activeSubscription = await this.subscriptionsRepository.findActiveByUserId(userId);

    //Если у нас есть активная подписка, то делаем продление
    if (activeSubscription) {
      //Если у нас подписка в ожидании, то есть stripeSubId еще не инициализирован, и эта подписка уже была оформлена, то внутренний рассинхрон
      if (!activeSubscription.stripeSubId) {
        this.logger.warn(`Trying to extend pending subscription ${activeSubscription.id}`);

        return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
      }

      //Если у нас нет покупателя или он в состоянии pending, то внутренний рассинхрон
      if (!customer || !stripeCusId) {
        this.logger.warn(
          `Trying to extend subscription ${activeSubscription.id} for pending or unexisting customer `,
        );

        return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
      }

      const dto: CreateCheckoutSessionDto = {
        mode: StripeCSModes.Payment,
        userId,
        plan: plan,
        stripeCusId: stripeCusId,
      };

      const stripeResult = await this.stripeService.createCheckoutSession(dto);
      if (stripeResult.hasErrors)
        return Notification.copyErrors<StripeCheckoutSessionResult, string>(stripeResult);

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.paymentsRepository.createPendingPayment(
            {
              subscriptionId: activeSubscription.id,
              plan: plan,
              externalId: stripeResult.value.sessionId,
            },
            tx,
          );

          await this.subscriptionsRepository.updateAutoRenewal(activeSubscription.id, true);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Some error occurred';

        this.logger.warn(
          `Saving new checkout session with id ${stripeResult.value.sessionId} in local db failed`,
        );
        return Notification.fail(NotificationResultCode.InternalServerError, errorMessage);
      }

      return Notification.ok(stripeResult.value.url);
      //Иначе мы создаем новую подписку
    } else {
      const dto: CreateCheckoutSessionDto = {
        mode: StripeCSModes.Subscription,
        userId,
        plan: plan,
        //Если у нас покупатель есть, то цепляем его, если нет то undefined
        stripeCusId: stripeCusId,
      };

      const stripeResult = await this.stripeService.createCheckoutSession(dto);
      if (stripeResult.hasErrors)
        return Notification.copyErrors<StripeCheckoutSessionResult, string>(stripeResult);

      try {
        await this.prisma.$transaction(async (tx) => {
          let customerId: number;

          if (!customer) {
            const createdCustomer = await this.customersRepository.createPendingCustomer(
              userId,
              tx,
            );
            customerId = createdCustomer.id;
          } else {
            customerId = customer.id;
          }

          await this.subscriptionsRepository.createPendingOrder(
            {
              customerId,
              planId: plan.id,
              amount: plan.priceInCents,
              externalId: stripeResult.value.sessionId,
            },
            tx,
          );
        });
      } catch {
        this.logger.warn(
          `Saving new checkout session with id ${stripeResult.value.sessionId} in local db failed`,
        );

        return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
      }

      return Notification.ok(stripeResult.value.url);
    }
  }
}
