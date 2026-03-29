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
import { PaymentsDomainExceptionCode } from '../../../../common/exceptions/domain-exception-codes';

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
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async execute({
    dto: { userId, planId },
  }: CreateCheckoutSessionCommand): Promise<Notification<string>> {
    const businessRules: BusinessRulesSettings =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings');
    const plan: Plan | undefined = businessRules.plans.find((p) => p.id === planId);

    if (!plan) {
      const notification: Notification<string> = Notification.fail<string>(
        PaymentsDomainExceptionCode.BadRequest,
        'Failed to initiate payment for the order',
      );

      notification.addExtension(
        'planId',
        `The selected tariff plan "${planId}" no longer exists in the system`,
      );

      return notification;
    }

    const stripeResult: Notification<StripeCheckoutSessionResult> =
      await this.stripeService.createCheckoutSession(plan.stripePriceId, plan.id, userId);

    if (stripeResult.hasErrors)
      return Notification.copyErrors<StripeCheckoutSessionResult, string>(stripeResult);

    await this.subscriptionsRepository.createPendingOrder({
      userId,
      planId,
      amount: plan.priceInCents,
      externalId: stripeResult.value.sessionId,
    });

    return Notification.ok(stripeResult.value.url);
  }
}
