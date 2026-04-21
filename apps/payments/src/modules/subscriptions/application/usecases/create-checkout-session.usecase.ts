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
import { CreateCheckoutSessionDTO } from '../services/types/CreateCheckoutSessionDTO';

export class CreateCheckoutSessionCommand {
  constructor(public readonly dto: CreateCheckoutSessionApplicationDto) {}
}

@CommandHandler(CreateCheckoutSessionCommand)
export class CreateCheckoutSessionUseCase
  implements ICommandHandler<CreateCheckoutSessionCommand, Notification<string>>
{
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly customersRepository: CustomersRepository,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
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
    const dto: CreateCheckoutSessionDTO = {
      userId,
      planId: plan.id,
      stripePriceId: plan.stripePriceId,
      //Если у нас покупатель есть, то цепляем его, если нет то undefined
      stripeCusId: customer?.stripeCusId,
    };
    const stripeResult = await this.stripeService.createCheckoutSession(dto);
    if (stripeResult.hasErrors)
      return Notification.copyErrors<StripeCheckoutSessionResult, string>(stripeResult);

    try {
      await this.saveCheckoutSession(customer, stripeResult.value, plan, userId);
    } catch {
      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Something went wrong with saving data',
      );
    }

    return Notification.ok(stripeResult.value.url);
  }

  private async saveCheckoutSession(
    customer: Customer | null,
    stripeResult: StripeCheckoutSessionResult,
    plan: Plan,
    userId: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      let customerId: number;
      if (!customer) {
        //Если у нас новый покупатель, то мы его создаем оборачивая в транзакцию с последующим созданием платежа и подписки
        const stripeCusId = stripeResult.stripeCusId;
        const createdCustomer = await this.customersRepository.createCustomer(
          { stripeCusId, userId },
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
          externalId: stripeResult.sessionId,
        },
        tx,
      );
    });
  }
}
