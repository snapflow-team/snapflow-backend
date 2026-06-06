import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isCheckoutSessionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { StripeService } from '../../services/stripe.service';
import { BillingPeriod } from '../../types/billing-period.type';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import {
  Customer,
  OutboxCommandType,
  OutboxEventType,
  Payment,
  Prisma,
  Subscription,
} from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionActivatedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { OutboxCommandRepository } from '../../../../outbox-commands/repositories/outbox-command.repository';
import { StripeExtendSubscriptionPayload } from '../../../../outbox-commands/executors/stripe-extend-subscription.payload';
import { Notification } from '../../../../../common/notification/notification';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable } from '@nestjs/common';
import { LoggerFactory } from '../../../../logger/logger.factory';
import { ContextLogger } from '../../../../logger/context-logger';
import { StripeCSModes } from '../../services/types/stripe-checkout-session-modes.enum';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { checkIsMetadata } from '../../type-guards/check-is-stripe-metadata.type-guard';
import { SubscriptionRenewedEvent } from '../../../../../../../../libs/contracts/payments/payment-subscription-renewed.event';
import { extractSubscriptionIdFromCS } from './utils/extract-subscription-id.helper';
import { extractCustomerId } from './utils/extract-customer-id.helper';
import { extractEventDate } from './utils/extract-date-from-event-created.helper';
import { QueueService } from '../../../../queue/queue.service';

@Injectable()
export class CheckoutSessionCompletedHandler implements WebhookHandler {
  private readonly logger: ContextLogger;
  type = StripeEvents.CheckoutSessionCompleted;
  constructor(
    private stripeService: StripeService,
    private paymentsRepository: PaymentsRepository,
    private customersRepository: CustomersRepository,
    private outboxRepository: OutboxRepository,
    private outboxCommandRepository: OutboxCommandRepository,
    private subscriptionsRepository: SubscriptionsRepository,
    private dateService: DateService,
    private queueService: QueueService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(CheckoutSessionCompletedHandler.name);
  }
  supports(event: Stripe.Event): boolean {
    return event.type === StripeEvents.CheckoutSessionCompleted;
  }

  async handle(event: Stripe.Event, tx: Prisma.TransactionClient): Promise<Notification<void>> {
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
      const message = `Stripe subscription in checkout session ${payload.id} doesn't exist`;
      this.logger.warn(message, this.handle.name);

      return Notification.fail(NotificationResultCode.BadRequest, message);
    }

    const localPayment: Payment | null = await this.paymentsRepository.findByExternalId(externalId);
    if (!localPayment) {
      this.logger.warn(`Local payment with externalId ${externalId} not found`, this.handle.name);

      return Notification.fail(NotificationResultCode.InternalServerError);
    }

    const localSubscription: Subscription | null = await this.subscriptionsRepository.findById(
      localPayment.subscriptionId,
    );
    if (!localSubscription) {
      this.logger.warn(
        `Local subscription with id ${localPayment.subscriptionId} not found`,
        this.handle.name,
      );

      return Notification.fail(NotificationResultCode.InternalServerError);
    }

    const localCustomer: Customer | null = await this.customersRepository.findById(
      localSubscription.customerId,
    );
    if (!localCustomer) {
      this.logger.warn(
        `Local customer with id ${localSubscription.customerId} not found`,
        this.handle.name,
      );

      return Notification.fail(NotificationResultCode.InternalServerError);
    }

    const periodResult: Notification<BillingPeriod> =
      await this.stripeService.retrieveSubscriptionBillingPeriod(stripeSubscriptionId);
    if (periodResult.hasErrors) {
      return Notification.copyErrors(periodResult);
    }

    const currentPeriod: BillingPeriod = periodResult.value;

    const stripeSubscriptionResult = await this.stripeService.getSubscription(stripeSubscriptionId);
    if (stripeSubscriptionResult.hasErrors) {
      this.logger.warn(`Failed to get subscription ${stripeSubscriptionId} from stripe`);
      return Notification.fail(NotificationResultCode.InternalServerError);
    }

    const stripeSubscription = stripeSubscriptionResult.value;

    const stripeCusId = extractCustomerId(stripeSubscription.customer);
    if (!stripeCusId) {
      this.logger.warn(
        `Customer with subscription: ${stripeSubscription.id} not found`,
        this.handle.name,
      );

      return Notification.fail(NotificationResultCode.InternalServerError);
    }

    switch (payload.mode) {
      //Если у нас приходит платеж на продление подписки
      case StripeCSModes.Payment: {
        if (!checkIsMetadata(payload.metadata)) {
          this.logger.log(
            `No metadata for stripe checkout session ${externalId}`,
            this.handle.name,
          );

          return Notification.fail(NotificationResultCode.InternalServerError);
        }

        const newEnd = this.dateService.addDaysToDate(
          currentPeriod.end,
          +payload.metadata.subscriptionDuration,
        );

        await this.paymentsRepository.markAsPaid(localPayment.id, tx);

        await this.subscriptionsRepository.extendSubscription(
          localPayment.subscriptionId,
          newEnd,
          extractEventDate(event),
          tx,
        );

        await this.outboxRepository.saveEvent(
          OutboxEventType.SUBSCRIPTION_RENEWED,
          {
            userId: localCustomer.userId,
            planId: localSubscription.planId,
            subscriptionId: localSubscription.id,
            currentPeriodEnd: newEnd.toISOString(),
          } satisfies SubscriptionRenewedEvent,
          tx,
        );

        await this.outboxCommandRepository.saveCommand(
          OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION,
          {
            stripeSubscriptionId,
            newEndIso: newEnd.toISOString(),
          } satisfies StripeExtendSubscriptionPayload,
          tx,
        );

        await this.queueService.addSubscriptionActivatedJob({
          userId: localCustomer.userId,
          expireAt: currentPeriod.end,
        });

        return Notification.ok();
      }
      case StripeCSModes.Subscription: {
        //Если у нас приходит платеж на оформление подписки
        await this.paymentsRepository.markAsPaid(localPayment.id, tx);

        await this.subscriptionsRepository.activateSubscription(
          {
            subscriptionId: localPayment.subscriptionId,
            stripeSubId: stripeSubscriptionId,
            currentPeriod,
            lastStripeEventAt: extractEventDate(event),
            stripeCusId: stripeCusId,
          },
          tx,
        );

        await this.outboxRepository.saveEvent(
          OutboxEventType.SUBSCRIPTION_ACTIVATED,
          {
            userId: localCustomer.userId,
            planId: localSubscription.planId,
            subscriptionId: localSubscription.id,
            currentPeriodEnd: currentPeriod.end.toISOString(),
          } satisfies SubscriptionActivatedEvent,
          tx,
        );

        await this.queueService.addSubscriptionActivatedJob({
          userId: localCustomer.userId,
          expireAt: currentPeriod.end,
        });

        return Notification.ok();
      }
      default:
        return Notification.ok();
    }
  }
}
