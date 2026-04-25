import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isInvoiceObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { OutboxEventType, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionActivatedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable, Logger } from '@nestjs/common';
import { extractSubscriptionId } from './utils/extract-subscription-id';
import { InvoicePayment, StripeService } from '../../services/stripe.service';
import { BillingPeriod } from '../../types/billing-period.type';

@Injectable()
export class InvoicePaymentSucceededHandler implements WebhookHandler {
  private readonly logger: Logger = new Logger(InvoicePaymentSucceededHandler.name);
  constructor(
    private stripeService: StripeService,
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
  ) {}
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.InvoicePaymentFailed;
  }
  async handle(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isInvoiceObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not an invoice object',
      );
    }
    //const invoiceId = payload.id;
    const invoiceSubscriptionRef: string | Stripe.Subscription | undefined =
      payload.parent?.subscription_details?.subscription;

    const stripeSubscriptionId: string | null = extractSubscriptionId(invoiceSubscriptionRef);

    if (!stripeSubscriptionId) {
      this.logger.warn(
        `Unable to extract Stripe subscription id from invoice ${payload.id} for invoice.payment_succeeded. Skipping.`,
      );
      return Notification.ok();
    }

    const localSubscription: Subscription | null =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (!localSubscription) {
      this.logger.warn(
        `No local subscription for Stripe subscription ${stripeSubscriptionId}, skipping invoice.payment_succeeded`,
      );
      return Notification.ok();
    }
    //const payment: InvoicePayment = await this.stripeService.retrieveSucceededPaymentFromInvoice(invoiceId);
    const customer = await this.customersRepository.findById(localSubscription.customerId);
    if (!customer) {
      return Notification.fail(
        NotificationResultCode.InternalServerError,
        `Customer with id ${localSubscription.customerId} not found`,
      );
    }
    const periodResult: Notification<BillingPeriod> =
      await this.stripeService.retrieveSubscriptionBillingPeriod(stripeSubscriptionId);

    if (periodResult.hasErrors) {
      return Notification.copyErrors(periodResult);
    }

    const currentPeriod: BillingPeriod = periodResult.value;

    await this.outboxRepository.saveEvent(OutboxEventType.SUBSCRIPTION_ACTIVATED, {
      userId: customer.userId,
      planId: localSubscription.planId,
      subscriptionId: localSubscription.id,
      currentPeriodEnd: currentPeriod.end.toISOString(),
      // attemptCount: payload.attempt_count,
      // nextPaymentAttempt:
      //   payload.next_payment_attempt === null
      //     ? null
      //     : new Date(payload.next_payment_attempt * 1000).toISOString(),
      // failureCode,
      // failureMessage,
    } satisfies SubscriptionActivatedEvent);

    return Notification.ok();
  }
}
