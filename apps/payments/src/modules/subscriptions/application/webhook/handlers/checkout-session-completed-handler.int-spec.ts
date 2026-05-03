import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, PaymentStatus, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeService } from '../../services/stripe.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { CheckoutSessionCompletedHandler } from './checkout-session-completed-handler';
import { Notification } from '../../../../../common/notification/notification';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { BillingPeriod } from '../../types/billing-period.type';

describe('CheckoutSessionCompletedHandler (Integration)', () => {
  let module: TestingModule;
  let handler: CheckoutSessionCompletedHandler;
  let prisma: PrismaService;

  const retrieveSubscriptionBillingPeriodMock = jest.fn();
  const getSubscriptionMock = jest.fn();

  const defaultEventCreated = 1_704_067_200;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({
        retrieveSubscriptionBillingPeriod: retrieveSubscriptionBillingPeriodMock,
        getSubscription: getSubscriptionMock,
      })
      .compile();

    handler = module.get<CheckoutSessionCompletedHandler>(CheckoutSessionCompletedHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE',
    );

    retrieveSubscriptionBillingPeriodMock.mockReset();
    getSubscriptionMock.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  function makeCheckoutCompletedEvent(params: {
    sessionId: string;
    subscription?: string | Stripe.Subscription | null;
    created?: number;
    /** подмена payload для type-guard (например invoice вместо session) */
    payloadOverride?: unknown;
  }): Stripe.Event {
    const { sessionId, subscription, created = defaultEventCreated, payloadOverride } = params;

    const sessionObject = payloadOverride ?? {
      id: sessionId,
      object: 'checkout.session',
      subscription: subscription ?? 'sub_default',
    };

    return {
      id: 'evt_checkout_completed',
      object: 'event',
      created,
      type: StripeEvents.CheckoutSessionCompleted,
      data: {
        object: sessionObject,
      },
    } as Stripe.Event;
  }

  async function seedPendingCheckout(sessionId: string, userId: number) {
    const customer = await prisma.customer.create({
      data: { userId },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.PENDING,
        payments: {
          create: {
            planId: 'business_monthly',
            externalId: sessionId,
            amount: 1000,
            status: PaymentStatus.PENDING,
          },
        },
      },
      include: { payments: true },
    });

    return { customer, subscription };
  }

  describe('supports', () => {
    it('возвращает false для события другого типа', () => {
      const event = {
        id: 'evt_other',
        object: 'event',
        type: StripeEvents.CheckoutSessionExpired,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для checkout.session.completed', () => {
      const event = {
        id: 'evt_1',
        object: 'event',
        type: StripeEvents.CheckoutSessionCompleted,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('BadRequest, если data.object не checkout.session', async () => {
      const event = makeCheckoutCompletedEvent({
        sessionId: 'cs_1',
        payloadOverride: {
          id: 'in_1',
          object: 'invoice',
        },
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);

      expect(await prisma.payment.count()).toBe(0);
      expect(await prisma.subscription.count()).toBe(0);
    });

    it('BadRequest, если у session нет subscription id', async () => {
      const event = makeCheckoutCompletedEvent({
        sessionId: 'cs_no_sub',
        payloadOverride: {
          id: 'cs_no_sub',
          object: 'checkout.session',
          subscription: null,
        },
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(await prisma.payment.count()).toBe(0);
    });

    it('NotFound, если платёж с externalId = session.id не найден', async () => {
      const event = makeCheckoutCompletedEvent({
        sessionId: 'cs_missing_payment',
        subscription: 'sub_orphan',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.NotFound);
    });

    it('пробрасывает ошибку retrieveSubscriptionBillingPeriod и не активирует подписку', async () => {
      const sessionId = 'cs_period_fail';
      const stripeSubId = 'sub_period_fail';
      await seedPendingCheckout(sessionId, 500);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.fail(
          NotificationResultCode.InternalServerError,
          'Stripe billing period error',
        ),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        subscription: stripeSubId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
      expect(retrieveSubscriptionBillingPeriodMock).toHaveBeenCalledWith(stripeSubId);
      expect(getSubscriptionMock).not.toHaveBeenCalled();

      const sub = await prisma.subscription.findFirst();
      expect(sub?.status).toBe(SubscriptionStatus.PENDING);
      const payment = await prisma.payment.findFirst();
      expect(payment?.status).toBe(PaymentStatus.PENDING);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('InternalServerError, если у subscription из Stripe нет customer id', async () => {
      const sessionId = 'cs_no_customer';
      const stripeSubId = 'sub_no_customer';
      await seedPendingCheckout(sessionId, 501);

      const periodStart = new Date('2026-01-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-01T00:00:00.000Z');
      const billingPeriod: BillingPeriod = { start: periodStart, end: periodEnd };

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(Notification.ok(billingPeriod));
      getSubscriptionMock.mockResolvedValue({
        id: stripeSubId,
        object: 'subscription',
        customer: null,
      } as unknown as Stripe.Subscription);

      const event = makeCheckoutCompletedEvent({
        sessionId,
        subscription: stripeSubId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const sub = await prisma.subscription.findFirst();
      expect(sub?.status).toBe(SubscriptionStatus.PENDING);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Позитивные сценарии', () => {
    it('сохраняет stripeCusId при customer как string', async () => {
      const sessionId = 'cs_cus_string';
      const stripeSubId = 'sub_cus_string';
      const stripeCusId = 'cus_string_id';
      const { customer } = await seedPendingCheckout(sessionId, 600);

      const periodStart = new Date('2026-03-01T00:00:00.000Z');
      const periodEnd = new Date('2026-04-01T00:00:00.000Z');
      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({ start: periodStart, end: periodEnd }),
      );
      getSubscriptionMock.mockResolvedValue({
        id: stripeSubId,
        object: 'subscription',
        customer: stripeCusId,
      } as unknown as Stripe.Subscription);

      const event = makeCheckoutCompletedEvent({ sessionId, subscription: stripeSubId });
      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(updatedCustomer?.stripeCusId).toBe(stripeCusId);
    });

    it('сохраняет stripeCusId при customer как expanded object', async () => {
      const sessionId = 'cs_cus_object';
      const stripeSubId = 'sub_cus_object';
      const stripeCusId = 'cus_expanded_id';
      const { customer } = await seedPendingCheckout(sessionId, 601);

      const periodStart = new Date('2026-03-01T00:00:00.000Z');
      const periodEnd = new Date('2026-04-01T00:00:00.000Z');
      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({ start: periodStart, end: periodEnd }),
      );
      getSubscriptionMock.mockResolvedValue({
        id: stripeSubId,
        object: 'subscription',
        customer: { id: stripeCusId, object: 'customer' } as Stripe.Customer,
      } as unknown as Stripe.Subscription);

      const event = makeCheckoutCompletedEvent({
        sessionId,
        subscription: {
          id: stripeSubId,
          object: 'subscription',
        } as Stripe.Subscription,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updatedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(updatedCustomer?.stripeCusId).toBe(stripeCusId);
    });

    it('полный happy path: PAID, ACTIVE, период, stripeSubId, outbox SUBSCRIPTION_ACTIVATED', async () => {
      const sessionId = 'cs_happy_full';
      const stripeSubId = 'sub_happy_full';
      const userId = 9_001;
      const periodStart = new Date('2026-01-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-01T00:00:00.000Z');

      const { customer, subscription } = await seedPendingCheckout(sessionId, userId);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({ start: periodStart, end: periodEnd }),
      );
      getSubscriptionMock.mockResolvedValue({
        id: stripeSubId,
        object: 'subscription',
        customer: 'cus_happy',
      } as unknown as Stripe.Subscription);

      const eventCreated = 1_726_531_200;
      const event = makeCheckoutCompletedEvent({
        sessionId,
        subscription: stripeSubId,
        created: eventCreated,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({
        where: { subscriptionId: subscription.id },
      });
      expect(payment?.status).toBe(PaymentStatus.PAID);

      const updatedSub = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updatedSub?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(updatedSub?.stripeSubId).toBe(stripeSubId);
      expect(updatedSub?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
      expect(updatedSub?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());
      expect(updatedSub?.lastStripeEventAt?.toISOString()).toBe(
        new Date(eventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_ACTIVATED },
      });
      expect(outbox).toBeDefined();
      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.userId,
          planId: 'business_monthly',
          subscriptionId: subscription.id,
          currentPeriodEnd: periodEnd.toISOString(),
        }),
      );
    });
  });
});
