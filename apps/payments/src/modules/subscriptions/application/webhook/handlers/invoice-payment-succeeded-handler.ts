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
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { PrismaService } from '../../../../database/prisma.service';
import { InternalServerException } from '../../../../../../../snapflow-core/src/common/exceptions/domain-exceptions';
import { checkIsOldEvent } from './utils/check-is-old-event';
import { extractEventDate } from './utils/extract-date-from-event-created';

@Injectable()
export class InvoicePaymentSucceededHandler implements WebhookHandler {
  private readonly logger: Logger = new Logger(InvoicePaymentSucceededHandler.name);
  constructor(
    private stripeService: StripeService,
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    private paymentsRepository: PaymentsRepository,
    private prisma: PrismaService,
  ) {}
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.InvoicePaymentSucceeded;
  }
  async handle(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isInvoiceObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not an invoice object',
      );
    }
    //Если прилетел ивент не на продление подписки, а на ее создание, то мы скипаем этот ивент
    if (!this.isSubscriptionRenewal(payload)) {
      return Notification.ok();
    }
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
    if (checkIsOldEvent(event, localSubscription)) {
      return Notification.ok();
    }
    const customer = await this.customersRepository.findById(localSubscription.customerId);
    if (!customer) {
      this.logger.warn(`Customer with id ${localSubscription.customerId} not found`);
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
      );
      return Notification.ok();
    }
    const paymentInfo: InvoicePayment = stripePaymentResult.value;

    await this.prisma.$transaction(async (tx) => {
      const renewedSubscription = await this.subscriptionsRepository.renewSubscription(
        localSubscription.id,
        newCurrentPeriod,
        extractEventDate(event),
        tx,
      );
      if (!renewedSubscription) {
        this.logger.warn(`Subscription with id ${localSubscription.id} was not found and renewed`);
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
        OutboxEventType.SUBSCRIPTION_ACTIVATED,
        {
          userId: customer.userId,
          planId: localSubscription.planId,
          subscriptionId: localSubscription.id,
          currentPeriodEnd: newCurrentPeriod.end.toISOString(),
        } satisfies SubscriptionActivatedEvent,
        tx,
      );
    });

    return Notification.ok();
  }
  //Этот метод нужен для определения поступил ли этот ивент к нам при продлении подписки. Потому что этот ивент может прийти и при создании подписки и мы не должны учитывать его
  private isSubscriptionRenewal(invoice: Stripe.Invoice): boolean {
    return invoice.billing_reason === 'subscription_cycle';
  }
}
