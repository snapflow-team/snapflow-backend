import { WebhookHandler } from '../webhook.handler';
import Stripe from 'stripe';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { isCheckoutSessionObject } from '../../type-guards/stripe-webhook.type-guards';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { StripeService } from '../../services/stripe.service';
import { BillingPeriod } from '../../types/billing-period.type';
import { PaymentsRepository } from '../../../infrastructure/payments.repository';
import { Customer, OutboxEventType, Payment } from '@generated/prisma-payments';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionActivatedEvent } from '../../../../../../../../libs/contracts/payments';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { Notification } from '../../../../../common/notification/notification';
import { PrismaService } from '../../../../database/prisma.service';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';
import { Injectable, Logger } from '@nestjs/common';
import { extractSubscriptionIdFromCS } from './utils/extract-subscription-id.helper';
import { extractEventDate } from './utils/extract-date-from-event-created.helper';
import { extractCustomerId } from './utils/extract-customer-id.helper';
import { StripeCSModes } from '../../services/types/stripe-checkout-session-modes.enum';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { checkIsMetadata } from './utils/check-is-stripe-metadata.helper';

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
    private dateService: DateService,
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
      this.logger.warn(`Stripe subscription in checkout session ${payload.id} is null`);

      return Notification.fail(
        NotificationResultCode.BadRequest,
        `Stripe checkout session ${externalId} does not contain subscription id`,
      );
    }

    const localPayment: Payment | null = await this.paymentsRepository.findByExternalId(externalId);
    if (!localPayment) {
      this.logger.warn(`Local payments with externalId ${externalId} not found`);

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Some error occurred with payment provider',
      );
    }

    const localSubscription =
      await this.subscriptionsRepository.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!localSubscription) {
      this.logger.warn(`Local subscription with stripeSubId ${stripeSubscriptionId} not found`);

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Some error occurred with payment provider',
      );
    }

    const localCustomer: Customer | null = await this.customersRepository.findById(
      localSubscription.customerId,
    );
    if (!localCustomer) {
      this.logger.warn(`Local customer with id ${localSubscription.customerId} not found`);

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Some error occurred with payment provider',
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
      this.logger.warn(`Stripe customer with subscription: ${stripeSubscription.id} not found`);

      return Notification.fail(
        NotificationResultCode.BadRequest,
        `Stripe customer with subscription: ${stripeSubscription.id} not found`,
      );
    }

    //Если у нас пришел ивент на покупку новой подписки юзером
    if (payload.mode === StripeCSModes.Payment) {
      //Находим в чекаут сессии метадату
      if (!checkIsMetadata(payload.metadata)) {
        this.logger.log(`No metadata for stripe checkout session ${externalId}`);

        return Notification.fail(
          NotificationResultCode.InternalServerError,
          'Some error occurred with payment provider',
        );
      }

      const newEnd = this.dateService.addDaysToDate(
        currentPeriod.end,
        +payload.metadata.subscriptionDuration,
      );

      await this.prisma.$transaction(async (tx) => {
        await this.paymentsRepository.markAsPaid(localPayment.id, tx);

        await this.subscriptionsRepository.extendSubscription(
          localPayment.subscriptionId,
          currentPeriod,
          extractEventDate(event),
        );

        await this.outboxRepository.saveEvent(
          OutboxEventType.SUBSCRIPTION_ACTIVATED,
          {
            userId: localCustomer.userId,
            planId: localSubscription.planId,
            subscriptionId: localSubscription.id,
            currentPeriodEnd: localSubscription.currentPeriodEnd?.toISOString() ?? null,
          } satisfies SubscriptionActivatedEvent,
          tx,
        );

        await this.stripeService.extendSubscription(stripeSubscriptionId, newEnd);
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
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
            currentPeriodEnd: localSubscription.currentPeriodEnd?.toISOString() ?? null,
          } satisfies SubscriptionActivatedEvent,
          tx,
        );
      });
    }
    return Notification.ok();
  }
}
