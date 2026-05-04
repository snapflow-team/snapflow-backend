import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isCheckoutSessionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { OutboxEventType, Payment, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { PrismaService } from '../../../../database/prisma.service';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { CheckoutSessionExpiredEvent } from '../../../../../../../../libs/contracts/payments/payments-checkout-sesion-expired.event';
import { Injectable } from '@nestjs/common';
import { extractEventDate } from './utils/extract-date-from-event-created.helper';

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
      //todo(vitaliy) нужно ли нам фэйлить платеж?
      await this.paymentsRepository.markAsFailed(payment.id, tx);

      const subscription: Subscription | null =
        await this.subscriptionsRepository.cancelSubscription(
          payment.subscriptionId,
          extractEventDate(event),
          tx,
        );
      if (!subscription) {
        return Notification.fail(
          NotificationResultCode.InternalServerError,
          `Subscription with id ${payment.subscriptionId} not found`,
        );
      }
      const customer = await this.customersRepository.findById(subscription.customerId);

      if (!customer) {
        return Notification.fail(
          NotificationResultCode.InternalServerError,
          `Customer with id ${subscription.customerId} not found`,
        );
      }
      await this.outboxRepository.saveEvent(
        OutboxEventType.CHECKOUT_SESSION_EXPIRED,
        {
          userId: customer.userId,
          planId: subscription.planId,
          description: 'checkout session expired',
        } satisfies CheckoutSessionExpiredEvent,
        tx,
      );
    });

    return Notification.ok();
  }
}
