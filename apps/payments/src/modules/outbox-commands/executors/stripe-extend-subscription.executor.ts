import { Injectable } from '@nestjs/common';
import { OutboxCommand, OutboxCommandType } from '@generated/prisma-payments';
import { StripeService } from '../../subscriptions/application/services/stripe.service';
import { StripeExtendSubscriptionPayload } from './stripe-extend-subscription.payload';

@Injectable()
export class StripeExtendSubscriptionExecutor {
  readonly type = OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION;

  constructor(private readonly stripeService: StripeService) {}

  async execute(command: OutboxCommand): Promise<void> {
    const payload: StripeExtendSubscriptionPayload = this.parsePayload(command);

    await this.stripeService.extendSubscription(
      payload.stripeSubscriptionId,
      new Date(payload.newEndIso),
      { idempotencyKey: command.id },
    );
  }

  private parsePayload(command: OutboxCommand): StripeExtendSubscriptionPayload {
    const payload = command.payload as unknown as StripeExtendSubscriptionPayload;

    if (!payload?.stripeSubscriptionId || !payload?.newEndIso) {
      throw new Error(`Invalid STRIPE_EXTEND_SUBSCRIPTION payload for command ${command.id}`);
    }

    return payload;
  }
}
