import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { SubscriptionsRepository } from '../../infrastructure/subscriptions.repository';
import { PrismaService } from '../../../database/prisma.service';
import { OutboxEventType, Payment, Subscription } from '@generated/prisma-payments';
import { Redis } from 'ioredis';
import { HandleStripeWebhookApplicationDto } from '../dto/handele-stripe-webhook.application-dto';
import { StripeService } from '../services/stripe.service';
import { OutboxRepository } from '../../../outbox/repositories/outbox.repository';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Notification } from '../../../../common/notification/notification';
import Stripe from 'stripe';
import { StripeEvents } from '../constants/stripe-events.constants';
import { PaymentsRepository } from '../../infrastructure/payments.repository';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';

export class HandleStripeWebhookCommand {
  constructor(public readonly dto: HandleStripeWebhookApplicationDto) {}
}

@CommandHandler(HandleStripeWebhookCommand)
export class HandleStripeWebhookUseCase
  implements ICommandHandler<HandleStripeWebhookCommand, Notification<void>>
{
  private readonly logger: Logger = new Logger(HandleStripeWebhookUseCase.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
  ) {}

  async execute({
    dto: { rawBody, signature },
  }: HandleStripeWebhookCommand): Promise<Notification<void>> {
    const stripeResult: Notification<Stripe.Event> = this.stripeService.constructEvent(
      rawBody,
      signature,
    );

    if (stripeResult.hasErrors) {
      return Notification.copyErrors(stripeResult);
    }

    const event: Stripe.Event = stripeResult.value;

    if (event.type !== StripeEvents.CheckoutSessionCompleted) {
      return Notification.ok();
    }

    const lockKey = `stripe_webhook_processed:${event.id}`;

    const isProcessed: string | null = await this.redis.get(lockKey);
    if (isProcessed) {
      this.logger.warn(`Event ${event.id} already processed. Skipping.`);
      return Notification.ok();
    }

    const session = event.data.object;

    const externalId: string = session.id;
    const stripeSubscriptionId: string | undefined =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!externalId || !stripeSubscriptionId) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        `Stripe session ${externalId} is missing critical IDs`,
      );
    }

    const payment: Payment | null = await this.paymentsRepository.findByExternalId(externalId);

    if (!payment) {
      return Notification.fail(
        NotificationResultCode.NotFound,
        `Payment with externalId ${externalId} not found`,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.paymentsRepository.markAsPaid(payment.id, tx);

        const subscription: Subscription = await this.subscriptionsRepository.activateSubscription(
          payment.subscriptionId,
          stripeSubscriptionId,
          tx,
        );

        await this.outboxRepository.saveEvent(
          OutboxEventType.PAYMENT_COMPLETED,
          {
            userId: subscription.userId,
            planId: subscription.planId,
            subscriptionId: subscription.id,
          },
          tx,
        );
      });

      await this.redis.set(lockKey, '1', 'EX', 86400);

      return Notification.ok();
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(`Failed: ${errorMessage}`, errorStack);

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Internal database error during webhook processing',
      );
    }
  }
}
