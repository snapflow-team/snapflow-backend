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
import { BillingPeriod } from '../types/billing-period.type';
import { isCheckoutSessionObject, isInvoiceObject, } from '../type-guards/stripe-webhook.type-guards';
import { PaymentCompletedEvent, PaymentFailedEvent, } from '../../../../../../../libs/contracts/payments';

const SUPPORTED_WEBHOOK_EVENTS: ReadonlySet<string> = new Set([
  StripeEvents.CheckoutSessionCompleted,
  StripeEvents.InvoicePaymentFailed,
]);

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

    if (!SUPPORTED_WEBHOOK_EVENTS.has(event.type)) {
      this.logger.warn(
        `Unsupported webhook event type "${event.type}" (eventId=${event.id}). Skipping.`,
      );

      return Notification.ok();
    }

    const idempotencyKey: string = `stripe_webhook_processed:${event.id}`;

    const isProcessed: string | null = await this.redis.get(idempotencyKey);

    if (isProcessed) {
      this.logger.warn(`Event ${event.id} already processed. Skipping.`);

      return Notification.ok();
    }

    let result: Notification<void>;

    try {
      switch (event.type) {
        case StripeEvents.CheckoutSessionCompleted:
          result = await this.handleCheckoutSessionCompleted(event);
          break;
        case StripeEvents.InvoicePaymentFailed:
          result = await this.handleInvoicePaymentFailed(event);
          break;
        default:
          result = Notification.ok();
      }
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(`Failed: ${errorMessage}`, errorStack);

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Internal database error during webhook processing',
      );
    }

    if (result.hasErrors) {
      return result;
    }

    await this.redis.set(idempotencyKey, '1', 'EX', 86400);

    return Notification.ok();
  }

  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isCheckoutSessionObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not a checkout.session object',
      );
    }

    const { id: externalId, subscription } = payload;

    const stripeSubscriptionId: string | undefined =
      typeof subscription === 'string' ? subscription : subscription?.id;

    if (!stripeSubscriptionId) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        `Stripe checkout session ${externalId} does not contain subscription id`,
      );
    }

    const payment: Payment | null = await this.paymentsRepository.findByExternalId(externalId);

    if (!payment) {
      return Notification.fail(
        NotificationResultCode.NotFound,
        `Payment with externalId ${externalId} not found`,
      );
    }

    const periodResult: Notification<BillingPeriod> =
      await this.stripeService.retrieveSubscriptionBillingPeriod(stripeSubscriptionId);

    if (periodResult.hasErrors) {
      return Notification.copyErrors(periodResult);
    }

    const currentPeriod: BillingPeriod = periodResult.value;

    await this.prisma.$transaction(async (tx) => {
      await this.paymentsRepository.markAsPaid(payment.id, tx);

      const subscription: Subscription = await this.subscriptionsRepository.activateSubscription(
        payment.subscriptionId,
        stripeSubscriptionId,
        currentPeriod,
        tx,
      );

      await this.outboxRepository.saveEvent(
        OutboxEventType.PAYMENT_COMPLETED,
        {
          userId: subscription.userId,
          planId: subscription.planId,
          subscriptionId: subscription.id,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        } satisfies PaymentCompletedEvent,
        tx,
      );
    });

    return Notification.ok();
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isInvoiceObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not an invoice object',
      );
    }

    const invoiceSubscriptionRef: string | Stripe.Subscription | undefined =
      payload.parent?.subscription_details?.subscription;

    const stripeSubscriptionId: string | null = this.extractSubscriptionId(invoiceSubscriptionRef);

    if (!stripeSubscriptionId) {
      this.logger.warn(
        `Unable to extract Stripe subscription id from invoice ${payload.id} for invoice.payment_failed. Skipping.`,
      );
      return Notification.ok();
    }

    const localSubscription: Subscription | null =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (!localSubscription) {
      this.logger.warn(
        `No local subscription for Stripe subscription ${stripeSubscriptionId}, skipping invoice.payment_failed`,
      );

      return Notification.ok();
    }

    const { failureCode, failureMessage } = this.extractInvoiceFailureDetails(payload);

    await this.outboxRepository.saveEvent(OutboxEventType.PAYMENT_FAILED, {
      userId: localSubscription.userId,
      planId: localSubscription.planId,
      subscriptionId: localSubscription.id,
      stripeInvoiceId: payload.id,
      attemptCount: payload.attempt_count,
      nextPaymentAttempt:
        payload.next_payment_attempt === null
          ? null
          : new Date(payload.next_payment_attempt * 1000).toISOString(),
      failureCode,
      failureMessage,
    } satisfies PaymentFailedEvent);

    return Notification.ok();
  }

  private extractSubscriptionId(
    subscription: string | Stripe.Subscription | undefined,
  ): string | null {
    if (typeof subscription === 'string') {
      return subscription;
    }

    if (
      subscription &&
      typeof subscription === 'object' &&
      'id' in subscription &&
      typeof subscription.id === 'string'
    ) {
      return subscription.id;
    }

    return null;
  }

  private extractInvoiceFailureDetails(invoice: Stripe.Invoice): {
    failureCode: string | null;
    failureMessage: string | null;
  } {
    const lastFinalizationError: Stripe.Invoice.LastFinalizationError | null =
      invoice.last_finalization_error;

    if (!lastFinalizationError) {
      return { failureCode: null, failureMessage: null };
    }
    return {
      failureCode: lastFinalizationError.code ?? null,
      failureMessage: lastFinalizationError.message ?? null,
    };
  }
}
