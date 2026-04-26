import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isInvoiceObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { OutboxEventType, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionRenewalFailedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable, Logger } from '@nestjs/common';
import { extractSubscriptionId } from './utils/extract-subscription-id';
import { extractInvoiceFailureDetails } from './utils/extract-invoice-failure-details';
import { extractCustomerId } from './utils/extract-customer-id';
import { checkIsOldEvent } from './utils/check-is-old-event';
import { extractEventDate } from './utils/extract-date-from-event-created';

@Injectable()
export class InvoicePaymentFailedHandler implements WebhookHandler {
  private readonly logger: Logger = new Logger(InvoicePaymentFailedHandler.name);
  constructor(
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
    if (!this.isSubscriptionRenewal(payload)) {
      //Если ивент не для продления подписки, то пропускаем его
      return Notification.ok();
    }

    const invoiceSubscriptionRef: string | Stripe.Subscription | undefined =
      payload.parent?.subscription_details?.subscription;

    const stripeSubscriptionId: string | null = extractSubscriptionId(invoiceSubscriptionRef);

    if (!stripeSubscriptionId) {
      this.logger.warn(
        `Unable to extract Stripe subscription id from invoice ${payload.id} for invoice.payment_failed. Skipping.`,
      );
      return Notification.ok();
    }

    const localSubscription: Subscription | null =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (!localSubscription) {
      this.logger.warn(`No local subscription for Stripe subscription ${stripeSubscriptionId}`);
      return Notification.ok();
    }
    if (checkIsOldEvent(event, localSubscription)) {
      return Notification.ok();
    }
    //Проверяем протухла ли подписка в нашей локальной бд
    //todo(vitaliy) возможно нам стоит учитывать это протухание
    if (
      localSubscription.currentPeriodEnd &&
      localSubscription.currentPeriodEnd < new Date(Date.now())
    ) {
      this.logger.warn(`Subscription: ${stripeSubscriptionId} have not been expired yet`);
    }
    await this.subscriptionsRepository.setToPastDue(localSubscription.id, extractEventDate(event));
    const stripeCusId = extractCustomerId(payload.customer);
    if (!stripeCusId) {
      this.logger.warn(`No customer in invoice: ${payload.id}`);
      return Notification.ok();
    }
    const customer = await this.customersRepository.findByStripeCustomerId(stripeCusId);

    if (!customer) {
      this.logger.warn(`No local customer found by stripeCusId : ${stripeCusId}`);
      return Notification.ok();
    }

    const { failureCode, failureMessage } = extractInvoiceFailureDetails(payload);

    await this.outboxRepository.saveEvent(OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED, {
      userId: customer.userId,
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
    } satisfies SubscriptionRenewalFailedEvent);

    return Notification.ok();
  }
  //Этот метод нужен для определения поступил ли этот ивент к нам при продлении подписки. Потому что этот ивент может прийти и при создании подписки и мы не должны учитывать его
  private isSubscriptionRenewal(invoice: Stripe.Invoice): boolean {
    return invoice.billing_reason === 'subscription_cycle';
  }
}
