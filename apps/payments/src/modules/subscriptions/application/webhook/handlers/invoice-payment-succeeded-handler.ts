import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isInvoiceObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { OutboxEventType, Prisma, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable } from '@nestjs/common';
import { extractSubscriptionId } from './utils/extract-subscription-id.helper';
import { StripeService } from '../../services/stripe.service';
import { BillingPeriod } from '../../types/billing-period.type';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { InternalServerException } from '../../../../../../../snapflow-core/src/common/exceptions/domain-exceptions';
import { checkIsOldEvent } from './utils/check-is-old-event.helper';
import { extractEventDate } from './utils/extract-date-from-event-created.helper';
import { isSubscriptionRenewal } from './utils/check-is-subscription-renewal.helper';
import { InvoicePayment } from '../../types/invoice-payment.type';
import { SubscriptionRenewedEvent } from '../../../../../../../../libs/contracts/payments/payment-subscription-renewed.event';
import { LoggerFactory } from '../../../../logger/logger.factory';
import { ContextLogger } from '../../../../logger/context-logger';
import { QueueService } from '../../../../queue/queue.service';

@Injectable()
export class InvoicePaymentSucceededHandler implements WebhookHandler {
  private readonly logger: ContextLogger;
  constructor(
    private stripeService: StripeService,
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    private paymentsRepository: PaymentsRepository,
    private queueService: QueueService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(InvoicePaymentSucceededHandler.name);
  }
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.InvoicePaymentSucceeded;
  }
  async handle(event: Stripe.Event, tx: Prisma.TransactionClient): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isInvoiceObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not an invoice object',
      );
    }

    //Если прилетел ивент не на продление подписки, а на ее создание, то мы скипаем этот ивент
    if (!isSubscriptionRenewal(payload)) {
      return Notification.ok();
    }

    const invoiceSubscriptionRef: string | Stripe.Subscription | undefined =
      payload.parent?.subscription_details?.subscription;

    const stripeSubscriptionId: string | null = extractSubscriptionId(invoiceSubscriptionRef);
    if (!stripeSubscriptionId) {
      this.logger.warn(
        `Unable to extract Stripe subscription id from invoice ${payload.id} for invoice.payment_succeeded. Skipping.`,
        this.handle.name,
      );
      return Notification.ok();
    }

    const localSubscription: Subscription | null =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!localSubscription) {
      this.logger.warn(
        `No local subscription for Stripe subscription ${stripeSubscriptionId}, skipping invoice.payment_succeeded`,
        this.handle.name,
      );
      return Notification.ok();
    }

    if (checkIsOldEvent(event, localSubscription)) {
      return Notification.ok();
    }

    const customer = await this.customersRepository.findById(localSubscription.customerId);
    if (!customer) {
      this.logger.warn(
        `Customer with id ${localSubscription.customerId} not found`,
        this.handle.name,
      );
      return Notification.ok();
    }

    const subscriptionNewPeriodResult: Notification<BillingPeriod> =
      await this.stripeService.retrieveSubscriptionBillingPeriod(stripeSubscriptionId);
    if (subscriptionNewPeriodResult.hasErrors) {
      return Notification.copyErrors(subscriptionNewPeriodResult);
    }

    const newCurrentPeriod: BillingPeriod = subscriptionNewPeriodResult.value;

    const stripePaymentResult = await this.stripeService.retrieveSucceededPaymentFromInvoice(
      payload.id,
    );
    if (stripePaymentResult.hasErrors) {
      this.logger.warn(
        `Parsing payment from invoice ${payload.id} failed, ${stripePaymentResult.message}`,
        this.handle.name,
      );
      return Notification.fail(NotificationResultCode.InternalServerError);
    }

    const paymentInfo: InvoicePayment = stripePaymentResult.value;

    const renewedSubscription = await this.subscriptionsRepository.renewSubscription(
      localSubscription.id,
      newCurrentPeriod,
      extractEventDate(event),
      tx,
    );
    if (!renewedSubscription) {
      this.logger.warn(
        `Subscription with id ${localSubscription.id} was not found and renewed`,
        this.handle.name,
      );
      throw new InternalServerException();
    }

    await this.paymentsRepository.createSucceededPayment(
      {
        amount: paymentInfo.amount,
        planId: renewedSubscription.planId,
        subscriptionId: renewedSubscription.id,
      },
      tx,
    );

    await this.outboxRepository.saveEvent(
      OutboxEventType.SUBSCRIPTION_RENEWED,
      {
        userId: customer.userId,
        planId: localSubscription.planId,
        subscriptionId: localSubscription.id,
        currentPeriodEnd: newCurrentPeriod.end.toISOString(),
      } satisfies SubscriptionRenewedEvent,
      tx,
    );

    await this.queueService.addSubscriptionNotifications({
      userId: customer.userId,
      expireAt: newCurrentPeriod.end.toISOString(),
      nextPaymentAt: newCurrentPeriod.end.toISOString(),
      subscriptionId: renewedSubscription.id,
    });

    return Notification.ok();
  }
}
