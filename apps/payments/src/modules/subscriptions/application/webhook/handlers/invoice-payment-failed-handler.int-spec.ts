import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { InvoicePaymentFailedHandler } from './invoice-payment-failed-handler';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { Notification } from '../../../../../common/notification/notification';

describe('InvoicePaymentFailedHandler (Integration)', () => {
  let module: TestingModule;
  let handler: InvoicePaymentFailedHandler;
  let prisma: PrismaService;

  const defaultEventCreated = 1_704_067_200; // 2023-11-27T00:00:00.000Z

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    }).compile();

    handler = module.get<InvoicePaymentFailedHandler>(InvoicePaymentFailedHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  function makeInvoicePaymentFailedEvent(params: {
    eventId?: string;
    created?: number;
    /** по умолчанию subscription_cycle (продление) */
    billingReason?: Stripe.Invoice.BillingReason | null;
    /** по умолчанию sub_default; null — без subscription (пропуск по id) */
    stripeSubscriptionRef?: string | Stripe.Subscription | null;
    invoiceId?: string;
    attemptCount?: number;
    nextPaymentAttempt?: number | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
    /** подмена payload (например не-invoice для type-guard) */
    payloadOverride?: unknown;
  }): Stripe.Event {
    const {
      eventId = 'evt_invoice_failed',
      created = defaultEventCreated,
      billingReason = 'subscription_cycle',
      stripeSubscriptionRef,
      invoiceId = 'in_test_1',
      attemptCount = 3,
      nextPaymentAttempt = 1_767_225_600,
      failureCode = 'card_declined',
      failureMessage = 'Your card was declined.',
      customer = 'cus_test_1',
      payloadOverride,
    } = params;

    const resolvedSubRef =
      stripeSubscriptionRef === undefined ? 'sub_default' : stripeSubscriptionRef;

    const invoiceObject =
      payloadOverride ??
      ({
        id: invoiceId,
        object: 'invoice',
        billing_reason: billingReason ?? undefined,
        attempt_count: attemptCount,
        next_payment_attempt: nextPaymentAttempt,
        customer,
        last_finalization_error:
          failureCode || failureMessage
            ? {
                code: failureCode,
                message: failureMessage,
              }
            : null,
        parent: {
          subscription_details: {
            subscription: resolvedSubRef === null ? undefined : resolvedSubRef,
          },
        },
      } as unknown as Stripe.Invoice);

    return {
      id: eventId,
      object: 'event',
      created,
      type: StripeEvents.InvoicePaymentFailed,
      data: {
        object: invoiceObject,
      },
    } as Stripe.Event;
  }

  async function seedRenewalContext(params: {
    userId: number;
    stripeSubId: string;
    stripeCusId: string;
    lastStripeEventAt?: Date | null;
  }) {
    const customer = await prisma.customer.create({
      data: {
        userId: params.userId,
        stripeCusId: params.stripeCusId,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId: params.stripeSubId,
        lastStripeEventAt: params.lastStripeEventAt ?? undefined,
      },
    });

    return { customer, subscription };
  }

  describe('supports', () => {
    it('возвращает false для события другого типа', () => {
      const event = {
        id: 'evt_other',
        object: 'event',
        type: StripeEvents.CheckoutSessionCompleted,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для invoice.payment_failed', () => {
      const event = {
        id: 'evt_1',
        object: 'event',
        type: StripeEvents.InvoicePaymentFailed,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('BadRequest, если data.object не invoice', async () => {
      const event = makeInvoicePaymentFailedEvent({
        payloadOverride: {
          id: 'sub_1',
          object: 'subscription',
        },
      });

      const result: Notification<void> = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Пропуск обработки', () => {
    it('ok без outbox, если billing_reason не subscription_cycle', async () => {
      const stripeSubId = 'sub_skip_billing';
      await seedRenewalContext({
        userId: 1,
        stripeSubId,
        stripeCusId: 'cus_skip',
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_skip_billing',
        billingReason: 'subscription_create',
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_skip',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);

      const sub = await prisma.subscription.findFirst({ where: { stripeSubId } });
      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('ok без outbox, если из invoice не извлекается subscription id', async () => {
      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_no_sub_id',
        stripeSubscriptionRef: null,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('ok без outbox, если локальной подписки с stripeSubId нет', async () => {
      await seedRenewalContext({
        userId: 2,
        stripeSubId: 'sub_local_only',
        stripeCusId: 'cus_2',
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_unknown_sub',
        stripeSubscriptionRef: 'sub_not_in_db',
        customer: 'cus_2',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('ok без outbox для старого события (lastStripeEventAt позже event.created)', async () => {
      const stripeSubId = 'sub_old_invoice_failed';
      const eventTime = new Date('2024-01-01T00:00:00.000Z');
      const eventCreated = Math.floor(eventTime.getTime() / 1000);

      const { subscription } = await seedRenewalContext({
        userId: 3,
        stripeSubId,
        stripeCusId: 'cus_3',
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          lastStripeEventAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_old_failed',
        created: eventCreated,
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_3',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);

      const sub = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('Позитивные сценарии', () => {
    it('продление: подписка PAST_DUE, outbox SUBSCRIPTION_RENEWAL_FAILED с полями контракта', async () => {
      const stripeSubId = 'sub_renewal_failed_1';
      const stripeCusId = 'cus_renewal_1';
      const userId = 42;
      const nextPaymentAttempt = 1_767_225_600; // 2026-01-31T00:00:00.000Z

      const { customer, subscription } = await seedRenewalContext({
        userId,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_renewal_failed_ok',
        invoiceId: 'in_failed_ok_1',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
        attemptCount: 2,
        nextPaymentAttempt,
        failureCode: 'insufficient_funds',
        failureMessage: 'Not enough funds.',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(updated?.lastStripeEventAt?.toISOString()).toBe(
        new Date(defaultEventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED },
      });

      expect(outbox?.payload).toEqual({
        userId: customer.userId,
        planId: 'business_monthly',
        subscriptionId: subscription.id,
        stripeInvoiceId: 'in_failed_ok_1',
        attemptCount: 2,
        nextPaymentAttempt: new Date(nextPaymentAttempt * 1000).toISOString(),
        failureCode: 'insufficient_funds',
        failureMessage: 'Not enough funds.',
      });
    });

    it('customer в invoice как расширенный объект: успех и корректный userId в outbox', async () => {
      const stripeSubId = 'sub_expanded_cus';
      const stripeCusId = 'cus_expanded_1';

      const { customer, subscription } = await seedRenewalContext({
        userId: 99,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_expanded_customer',
        invoiceId: 'in_exp_cus',
        stripeSubscriptionRef: stripeSubId,
        customer: { id: stripeCusId, object: 'customer' } as Stripe.Customer,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.userId,
          subscriptionId: subscription.id,
        }),
      );
    });

    it('stripe subscription в parent как объект: извлекается id', async () => {
      const stripeSubId = 'sub_from_object';
      const stripeCusId = 'cus_obj_sub';

      await seedRenewalContext({
        userId: 11,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_sub_object',
        invoiceId: 'in_sub_obj',
        stripeSubscriptionRef: {
          id: stripeSubId,
          object: 'subscription',
        } as Stripe.Subscription,
        customer: stripeCusId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(1);
    });
  });

  describe('Граничные случаи', () => {
    it('next_payment_attempt: null попадает в outbox как null', async () => {
      const stripeSubId = 'sub_next_null';
      const stripeCusId = 'cus_next_null';

      const { subscription } = await seedRenewalContext({
        userId: 12,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_next_null',
        invoiceId: 'in_next_null',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
        nextPaymentAttempt: null,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          subscriptionId: subscription.id,
          nextPaymentAttempt: null,
        }),
      );
    });

    it('без last_finalization_error: failureCode и failureMessage null в outbox', async () => {
      const stripeSubId = 'sub_no_err';
      const stripeCusId = 'cus_no_err';

      const { subscription } = await seedRenewalContext({
        userId: 13,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_no_fin_err',
        invoiceId: 'in_no_err',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
        failureCode: null,
        failureMessage: null,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          subscriptionId: subscription.id,
          failureCode: null,
          failureMessage: null,
        }),
      );
    });

    /**
     * В колбэке $transaction возвращается Notification.fail, но наружу handle всё равно отдаёт ok:
     * setToPastDue уже выполнен, outbox не пишется.
     */
    it('customer отсутствует в invoice: подписка всё равно PAST_DUE, outbox нет, результат ok', async () => {
      const stripeSubId = 'sub_no_cus_invoice';
      const stripeCusId = 'cus_irrelevant';

      const { subscription } = await seedRenewalContext({
        userId: 14,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_no_customer_field',
        stripeSubscriptionRef: stripeSubId,
        customer: null,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('customer в invoice есть, локального customer по stripeCusId нет: PAST_DUE, outbox нет, результат ok', async () => {
      const stripeSubId = 'sub_missing_local_cus';
      const stripeCusId = 'cus_only_in_stripe';

      const { subscription } = await seedRenewalContext({
        userId: 15,
        stripeSubId,
        stripeCusId: 'cus_in_db_different',
      });

      const event = makeInvoicePaymentFailedEvent({
        eventId: 'evt_orphan_stripe_cus',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });
});
