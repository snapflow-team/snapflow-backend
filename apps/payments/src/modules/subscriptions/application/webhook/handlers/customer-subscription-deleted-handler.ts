import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isSubscriptionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { OutboxEventType, Subscription } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { PrismaService } from '../../../../database/prisma.service';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable } from '@nestjs/common';
import { extractEventDate } from './utils/extract-date-from-event-created';
import { extractSubscriptionId } from './utils/extract-subscription-id';
import { checkIsOldEvent } from './utils/check-is-old-event';
import { SubscriptionCancelledEvent } from '../../../../../../../../libs/contracts/payments/payments-subscription-cancelled.event';
import { extractCancelledAt } from './utils/extract-cancelled-at';
import { LoggerFactory } from '../../../../logger/logger.factory';
import { ContextLogger } from '../../../../logger/context-logger';

@Injectable()
export class CustomerSubscriptionDeletedHandler implements WebhookHandler {
  private readonly logger: ContextLogger;
  constructor(
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    private prisma: PrismaService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(CustomerSubscriptionDeletedHandler.name);
  }
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.SubscriptionDeleted;
  }
  async handle(event: Stripe.Event): Promise<Notification<void>> {
    const payload = event.data.object;

    if (!isSubscriptionObject(payload)) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Webhook payload is not a subscription object',
      );
    }

    const stripeSubId = extractSubscriptionId(payload.id);
    if (!stripeSubId) {
      this.logger.warn(`Failed to extract subscription for event ${event.id}`, this.handle.name);
      return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
    }

    const localSubscription =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubId);
    if (!localSubscription) {
      this.logger.warn(`Subscription with id ${stripeSubId} not found`, this.handle.name);
      return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
    }

    if (checkIsOldEvent(event, localSubscription)) {
      this.logger.warn(`This event is old ${event.id}, skipping`, this.handle.name);
      return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
    }

    const cancelledAt = extractCancelledAt(payload.canceled_at);
    if (!cancelledAt) {
      this.logger.warn(
        `This subscription have no canceled_at value ${stripeSubId}`,
        this.handle.name,
      );
      return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
    }

    await this.prisma.$transaction(async (tx) => {
      const subscription: Subscription | null =
        await this.subscriptionsRepository.cancelSubscription(
          localSubscription.id,
          extractEventDate(event),
          tx,
        );
      if (!subscription) {
        return Notification.fail(
          NotificationResultCode.InternalServerError,
          `Subscription with id ${localSubscription.id} not found`,
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
        OutboxEventType.SUBSCRIPTION_CANCELLED,
        {
          userId: customer.id,
          planId: subscription.planId,
          subscriptionId: subscription.id,
          cancelledAt: cancelledAt,
        } satisfies SubscriptionCancelledEvent,
        tx,
      );
    });

    return Notification.ok();
  }
}
