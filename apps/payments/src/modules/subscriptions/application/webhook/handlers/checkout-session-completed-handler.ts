import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isCheckoutSessionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { StripeService } from '../../services/stripe.service';
import { BillingPeriod } from '../../types/billing-period.type';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { OutboxEventType, Payment, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionActivatedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { PrismaService } from '../../../../database/prisma.service';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CheckoutSessionCompletedHandler implements WebhookHandler {
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

    const { id: externalId, subscription } = payload;

    //todo(vitaliy) вынести в экстрактер
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

    //todo надо ли обернуть в try catch, чтобы отдавать Notification?
    await this.prisma.$transaction(async (tx) => {
      await this.paymentsRepository.markAsPaid(payment.id, tx);

      const subscription: Subscription = await this.subscriptionsRepository.activateSubscription(
        payment.subscriptionId,
        stripeSubscriptionId,
        currentPeriod,
        tx,
      );
      const user = await this.customersRepository.findById(subscription.customerId);

      if (!user) {
        return Notification.fail(
          NotificationResultCode.InternalServerError,
          `Customer with id ${subscription.customerId} not found`,
        );
      }
      await this.outboxRepository.saveEvent(
        OutboxEventType.SUBSCRIPTION_ACTIVATED,
        {
          userId: user.id,
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
