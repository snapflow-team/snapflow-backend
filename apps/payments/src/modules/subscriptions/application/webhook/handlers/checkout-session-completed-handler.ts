import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isCheckoutSessionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { StripeService } from '../../services/stripe.service';
import { BillingPeriod } from '../../types/billing-period.type';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { Customer, OutboxEventType, Payment, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionActivatedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { PrismaService } from '../../../../database/prisma.service';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable, Logger } from '@nestjs/common';
import { extractSubscriptionIdFromCS } from './utils/extract-subscription-id';
import { extractEventDate } from './utils/extract-date-from-event-created';
import { InternalServerException } from '../../../../../../../snapflow-core/src/common/exceptions/domain-exceptions';
import { extractCustomerId } from './utils/extract-customer-id';

@Injectable()
export class CheckoutSessionCompletedHandler implements WebhookHandler {
  private readonly logger = new Logger(CheckoutSessionCompletedHandler.name);
  type = StripeEvents.CheckoutSessionCompleted;
  constructor(
    private stripeService: StripeService,
    private paymentsRepository: PaymentsRepository,
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    private prisma: PrismaService,
  ) {}
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.CheckoutSessionCompleted;
  }
  async handle(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isCheckoutSessionObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not a checkout.session object',
      );
    }

    const { id: externalId } = payload;

    const stripeSubscriptionId: string | null = extractSubscriptionIdFromCS(payload);
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

    const stripeSubscription = await this.stripeService.getSubscription(stripeSubscriptionId);

    const stripeCusId = extractCustomerId(stripeSubscription.customer);
    if (!stripeCusId) {
      this.logger.warn(`Customer with subscription: ${stripeSubscription.id} not found`);
      return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.paymentsRepository.markAsPaid(payment.id, tx);

      const subscription: Subscription | null =
        await this.subscriptionsRepository.activateSubscription(
          {
            subscriptionId: payment.subscriptionId,
            stripeSubId: stripeSubscriptionId,
            currentPeriod,
            lastStripeEventAt: extractEventDate(event),
            stripeCusId: stripeCusId,
          },
          tx,
        );
      if (!subscription) {
        this.logger.warn(`Subscription with id ${payment.subscriptionId} not found`);
        throw new InternalServerException();
      }

      const customer: Customer | null = await this.customersRepository.findById(
        subscription.customerId,
      );
      if (!customer) {
        this.logger.warn(`Customer with id ${subscription.customerId} not found`);
        throw new InternalServerException();
      }

      await this.outboxRepository.saveEvent(
        OutboxEventType.SUBSCRIPTION_ACTIVATED,
        {
          userId: customer.id,
          planId: subscription.planId,
          subscriptionId: subscription.id,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        } satisfies SubscriptionActivatedEvent,
        tx,
      );
    });

    return Notification.ok();
  }
}
