import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, PaymentStatus, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { CheckoutSessionExpiredHandler } from './checkout-session-expired-handler';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';

describe('CheckoutSessionExpiredHandler (Integration)', () => {
  let module: TestingModule;
  let handler: CheckoutSessionExpiredHandler;
  let prisma: PrismaService;
  let customersRepository: CustomersRepository;
  let subscriptionsRepository: SubscriptionsRepository;

  const defaultEventCreated = 1_704_067_200;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    }).compile();

    handler = module.get<CheckoutSessionExpiredHandler>(CheckoutSessionExpiredHandler);
    prisma = module.get<PrismaService>(PrismaService);
    customersRepository = module.get<CustomersRepository>(CustomersRepository);
    subscriptionsRepository = module.get<SubscriptionsRepository>(SubscriptionsRepository);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE',
    );
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  function makeCheckoutSessionExpiredEvent(params: {
    sessionId: string;
    created?: number;
    payloadOverride?: unknown;
  }): Stripe.Event {
    const { sessionId, created = defaultEventCreated, payloadOverride } = params;

    const sessionObject = payloadOverride ?? {
      id: sessionId,
      object: 'checkout.session',
    };

    return {
      id: 'evt_checkout_expired',
      object: 'event',
      created,
      type: StripeEvents.CheckoutSessionExpired,
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
        type: StripeEvents.CheckoutSessionCompleted,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для checkout.session.expired', () => {
      const event = {
        id: 'evt_1',
        object: 'event',
        type: StripeEvents.CheckoutSessionExpired,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('BadRequest, если data.object не checkout.session', async () => {
      const event = makeCheckoutSessionExpiredEvent({
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

    it('NotFound, если платёж с externalId = session.id не найден', async () => {
      const event = makeCheckoutSessionExpiredEvent({
        sessionId: 'cs_missing',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.NotFound);
    });
  });

  describe('Позитивный сценарий', () => {
    it('PENDING платёж и подписка: FAILED, подписка CANCELLED, outbox CHECKOUT_SESSION_EXPIRED', async () => {
      const sessionId = 'cs_expired_happy';
      const userId = 42;
      const eventCreated = 1_726_531_200;

      const { customer, subscription } = await seedPendingCheckout(sessionId, userId);

      const event = makeCheckoutSessionExpiredEvent({
        sessionId,
        created: eventCreated,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({
        where: { subscriptionId: subscription.id },
      });
      expect(payment?.status).toBe(PaymentStatus.FAILED);

      const updatedSub = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updatedSub?.status).toBe(SubscriptionStatus.CANCELLED);
      expect(updatedSub?.autoRenewal).toBe(false);
      expect(updatedSub?.lastStripeEventAt?.toISOString()).toBe(
        new Date(eventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.CHECKOUT_SESSION_EXPIRED },
      });
      expect(outbox).toBeDefined();
      /** Контракт называет поле userId, фактически в payload кладётся id строки customers (см. хендлер). */
      expect(outbox?.payload).toEqual({
        userId: customer.id,
        planId: 'business_monthly',
        description: 'checkout session expired',
      });
    });
  });

  /**
   * Внутри `prisma.$transaction` при `return Notification.fail(...)` ошибка не пробрасывается наружу,
   * колбэк завершается без throw — транзакция коммитится. Снаружи `handle` всё равно возвращает `Notification.ok()`.
   * Сид для «нет подписки по FK» из коробки невозможен (payment.subscription_id обязан существовать).
   */
  describe('Проблемные ветки: фактическое поведение', () => {
    it('cancelSubscription вернул null: платёж FAILED, подписка не меняется, handle всё равно ok без outbox', async () => {
      const sessionId = 'cs_cancel_null';
      await seedPendingCheckout(sessionId, 100);

      jest.spyOn(subscriptionsRepository, 'cancelSubscription').mockResolvedValueOnce(null);

      const event = makeCheckoutSessionExpiredEvent({ sessionId });
      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({ where: { externalId: sessionId } });
      expect(payment?.status).toBe(PaymentStatus.FAILED);

      const sub = await prisma.subscription.findFirst();
      expect(sub?.status).toBe(SubscriptionStatus.PENDING);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('customer не найден после отмены подписки: FAILED + CANCELLED, handle ok, outbox нет', async () => {
      const sessionId = 'cs_no_customer_row';
      await seedPendingCheckout(sessionId, 101);

      jest.spyOn(customersRepository, 'findById').mockResolvedValueOnce(null);

      const event = makeCheckoutSessionExpiredEvent({ sessionId });
      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({ where: { externalId: sessionId } });
      expect(payment?.status).toBe(PaymentStatus.FAILED);

      const sub = await prisma.subscription.findFirst();
      expect(sub?.status).toBe(SubscriptionStatus.CANCELLED);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });
});
