import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { InvoicePaymentFailedHandler } from './invoice-payment-failed-handler';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
describe('InvoicePaymentFailedHandler (Integration)', () => {
  let module: TestingModule;
  let handler: InvoicePaymentFailedHandler;
  let prisma: PrismaService;

  const defaultEventCreated = 1_704_067_200;

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

  async function executeHandler(event: Stripe.Event) {
    return prisma.$transaction((tx) => handler.handle(event, tx));
  }

  function makeInvoicePaymentFailedEvent(params: {
    eventId?: string;
    created?: number;
    billingReason?: Stripe.Invoice.BillingReason | null;
    stripeSubscriptionRef?: string | Stripe.Subscription | null;
    invoiceId?: string;
    attemptCount?: number;
    nextPaymentAttempt?: number | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
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
    currentPeriodEnd?: Date | null;
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
        currentPeriodEnd: params.currentPeriodEnd ?? undefined,
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
    it('возвращает BadRequest если data.object не invoice', async () => {
      const event = makeInvoicePaymentFailedEvent({
        payloadOverride: {
          id: 'sub_1',
          object: 'subscription',
        },
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError если не удалось перевести подписку в PAST_DUE', async () => {
      const stripeSubId = 'sub_set_failed';

      await seedRenewalContext({
        userId: 1,
        stripeSubId,
        stripeCusId: 'cus_1',
      });

      await prisma.subscription.deleteMany();

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_1',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
    });

    it('возвращает InternalServerError если customer отсутствует в invoice', async () => {
      const stripeSubId = 'sub_no_customer';

      const { subscription } = await seedRenewalContext({
        userId: 2,
        stripeSubId,
        stripeCusId: 'cus_2',
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: null,
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError если локальный customer не найден', async () => {
      const stripeSubId = 'sub_missing_customer';

      const { subscription } = await seedRenewalContext({
        userId: 3,
        stripeSubId,
        stripeCusId: 'cus_real',
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_unknown',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Пропуск обработки или другие негативные сценарии', () => {
    it('пропускает событие если billing_reason не subscription_cycle', async () => {
      const stripeSubId = 'sub_skip_billing';

      await seedRenewalContext({
        userId: 10,
        stripeSubId,
        stripeCusId: 'cus_skip',
      });

      const event = makeInvoicePaymentFailedEvent({
        billingReason: 'subscription_create',
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_skip',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);

      const sub = await prisma.subscription.findFirst({
        where: { stripeSubId },
      });

      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('возвращает InternalServerError если не удалось извлечь subscription id', async () => {
      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: null,
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError если локальная подписка не найдена', async () => {
      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: 'sub_unknown',
        customer: 'cus_unknown',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('пропускает старое событие', async () => {
      const stripeSubId = 'sub_old_event';

      const eventTime = new Date('2024-01-01T00:00:00.000Z');
      const eventCreated = Math.floor(eventTime.getTime() / 1000);

      const { subscription } = await seedRenewalContext({
        userId: 20,
        stripeSubId,
        stripeCusId: 'cus_old',
        lastStripeEventAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const event = makeInvoicePaymentFailedEvent({
        created: eventCreated,
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_old',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const unchanged = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(unchanged?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Позитивные сценарии', () => {
    it('переводит подписку в PAST_DUE и сохраняет outbox событие', async () => {
      const stripeSubId = 'sub_renewal_failed';
      const stripeCusId = 'cus_renewal_failed';
      const nextPaymentAttempt = 1_767_225_600;

      const { customer, subscription } = await seedRenewalContext({
        userId: 42,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        invoiceId: 'in_failed_1',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
        attemptCount: 2,
        nextPaymentAttempt,
        failureCode: 'insufficient_funds',
        failureMessage: 'Not enough funds.',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);

      expect(updated?.lastStripeEventAt?.toISOString()).toBe(
        new Date(defaultEventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED,
        },
      });

      expect(outbox?.payload).toEqual({
        userId: customer.userId,
        planId: 'business_monthly',
        subscriptionId: subscription.id,
        stripeInvoiceId: 'in_failed_1',
        attemptCount: 2,
        nextPaymentAttempt: new Date(nextPaymentAttempt * 1000).toISOString(),
        failureCode: 'insufficient_funds',
        failureMessage: 'Not enough funds.',
      });
    });

    it('корректно обрабатывает customer как expanded object', async () => {
      const stripeSubId = 'sub_expanded_customer';
      const stripeCusId = 'cus_expanded';

      const { customer, subscription } = await seedRenewalContext({
        userId: 50,
        stripeSubId,
        stripeCusId,
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: {
          id: stripeCusId,
          object: 'customer',
        } as Stripe.Customer,
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED,
        },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.userId,
          subscriptionId: subscription.id,
        }),
      );
    });

    it('корректно извлекает subscription id из expanded object', async () => {
      const stripeSubId = 'sub_object';

      await seedRenewalContext({
        userId: 60,
        stripeSubId,
        stripeCusId: 'cus_object',
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: {
          id: stripeSubId,
          object: 'subscription',
        } as Stripe.Subscription,
        customer: 'cus_object',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(1);
    });

    it('сохраняет nextPaymentAttempt как null', async () => {
      const stripeSubId = 'sub_null_attempt';

      const { subscription } = await seedRenewalContext({
        userId: 70,
        stripeSubId,
        stripeCusId: 'cus_null_attempt',
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_null_attempt',
        nextPaymentAttempt: null,
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED,
        },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          subscriptionId: subscription.id,
          nextPaymentAttempt: null,
        }),
      );
    });

    it('сохраняет null failureCode и failureMessage если ошибки нет', async () => {
      const stripeSubId = 'sub_no_failure';

      const { subscription } = await seedRenewalContext({
        userId: 80,
        stripeSubId,
        stripeCusId: 'cus_no_failure',
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_no_failure',
        failureCode: null,
        failureMessage: null,
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED,
        },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          subscriptionId: subscription.id,
          failureCode: null,
          failureMessage: null,
        }),
      );
    });

    it('обрабатывает подписку с уже истекшим currentPeriodEnd', async () => {
      const stripeSubId = 'sub_expired';

      const { subscription } = await seedRenewalContext({
        userId: 90,
        stripeSubId,
        stripeCusId: 'cus_expired',
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      });

      const event = makeInvoicePaymentFailedEvent({
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_expired',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated?.status).toBe(SubscriptionStatus.PAST_DUE);
    });
  });
});
