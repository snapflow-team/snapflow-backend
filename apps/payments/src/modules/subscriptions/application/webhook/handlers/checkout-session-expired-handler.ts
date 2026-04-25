import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isCheckoutSessionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { StripeService } from '../../services/stripe.service';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { OutboxEventType, Payment, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { PrismaService } from '../../../../database/prisma.service';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { CheckoutSessionExpiredEvent } from '../../../../../../../../libs/contracts/payments/payments-checkout-sesion-expired.event';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CheckoutSessionExpiredHandler implements WebhookHandler {
  constructor(
    private paymentsRepository: PaymentsRepository,
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    private prisma: PrismaService,
  ) {}
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.CheckoutSessionExpired;
  }
  async handle(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isCheckoutSessionObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not a checkout.session object',
      );
    }

    //Нам здесь нужен только externalId чекаут сессии, так как подписка не будет оформлена и не будет id подписки
    const { id: externalId } = payload;

    const payment: Payment | null = await this.paymentsRepository.findByExternalId(externalId);

    if (!payment) {
      return Notification.fail(
        NotificationResultCode.NotFound,
        `Payment with externalId ${externalId} not found`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.paymentsRepository.markAsFailed(payment.id, tx);

      const subscription: Subscription = await this.subscriptionsRepository.cancelSubscription(
        payment.subscriptionId,
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
        OutboxEventType.CHECKOUT_SESSION_EXPIRED,
        {
          userId: user.id,
          planId: subscription.planId,
          description: 'checkout session expired',
        } satisfies CheckoutSessionExpiredEvent,
        tx,
      );
    });

    return Notification.ok();
  }
}
