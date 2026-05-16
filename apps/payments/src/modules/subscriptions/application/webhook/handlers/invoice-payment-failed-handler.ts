import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isInvoiceObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { OutboxEventType, Prisma, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionRenewalFailedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable } from '@nestjs/common';
import { extractSubscriptionId } from './utils/extract-subscription-id.helper';
import { extractInvoiceFailureDetails } from './utils/extract-invoice-failure-details.helper';
import { extractCustomerId } from './utils/extract-customer-id.helper';
import { checkIsOldEvent } from './utils/check-is-old-event.helper';
import { extractEventDate } from './utils/extract-date-from-event-created.helper';
import { isSubscriptionRenewal } from './utils/check-is-subscription-renewal.helper';
import { LoggerFactory } from '../../../../logger/logger.factory';
import { ContextLogger } from '../../../../logger/context-logger';

@Injectable()
export class InvoicePaymentFailedHandler implements WebhookHandler {
  private readonly logger: ContextLogger;
  constructor(
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(InvoicePaymentFailedHandler.name);
  }
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.InvoicePaymentFailed;
  }
  async handle(
    event: Stripe.Event,
    tx: Prisma.TransactionClient,
  ): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isInvoiceObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not an invoice object',
      );
    }

    if (!isSubscriptionRenewal(payload)) {
      //Если ивент не для продления подписки, то пропускаем его
      return Notification.ok();
    }

    const invoiceSubscriptionRef: string | Stripe.Subscription | undefined =
      payload.parent?.subscription_details?.subscription;

    const stripeSubscriptionId: string | null = extractSubscriptionId(invoiceSubscriptionRef);

    if (!stripeSubscriptionId) {
      this.logger.warn(
        `Unable to extract Stripe subscription id from invoice ${payload.id} for invoice.payment_failed. Skipping.`,
        this.handle.name,
      );
      return Notification.ok();
    }

    const localSubscription: Subscription | null =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!localSubscription) {
      this.logger.warn(
        `No local subscription for Stripe subscription ${stripeSubscriptionId}`,
        this.handle.name,
      );
      return Notification.ok();
    }

    if (checkIsOldEvent(event, localSubscription)) {
      this.logger.warn(`This event is old ${event.type}, skipping.`, this.handle.name);
      return Notification.ok();
    }

    //Проверяем протухла ли подписка в нашей локальной бд
    //todo(vitaliy) возможно нам стоит учитывать это протухание
    if (
      localSubscription.currentPeriodEnd &&
      localSubscription.currentPeriodEnd < new Date(Date.now())
    ) {
      this.logger.warn(
        `Subscription: ${stripeSubscriptionId} have not been expired yet`,
        this.handle.name,
      );
    }

    await this.subscriptionsRepository.setToPastDue(
      localSubscription.id,
      extractEventDate(event),
      tx,
    );

    const stripeCusId = extractCustomerId(payload.customer);
    if (!stripeCusId) {
      this.logger.warn(`No customer in invoice: ${payload.id}`, this.handle.name);
      return Notification.fail(NotificationResultCode.InternalServerError, 'some error occurred');
    }

    const customer = await this.customersRepository.findByStripeCustomerId(stripeCusId, tx);
    if (!customer) {
      this.logger.warn(`No local customer found by stripeCusId : ${stripeCusId}`, this.handle.name);
      return Notification.fail(NotificationResultCode.InternalServerError, 'some error occurred');
    }

    const { failureCode, failureMessage } = extractInvoiceFailureDetails(payload);

    await this.outboxRepository.saveEvent(
      OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED,
      {
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
      } satisfies SubscriptionRenewalFailedEvent,
      tx,
    );

    return Notification.ok();
  }
}
