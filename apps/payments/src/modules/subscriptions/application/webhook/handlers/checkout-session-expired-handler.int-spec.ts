import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, PaymentStatus, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { CheckoutSessionExpiredHandler } from './checkout-session-expired-handler';
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
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        outbox_events,
        payments,
        subscriptions,
        customers
      RESTART IDENTITY CASCADE
    `);

    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  async function executeInTx(event: Stripe.Event) {
    return prisma.$transaction((tx) => handler.handle(event, tx));
  }

  function makeCheckoutSessionExpiredEvent(params: {
    sessionId: string;
    created?: number;
    payloadOverride?: unknown;
  }): Stripe.Event {
    const { sessionId, created = defaultEventCreated, payloadOverride } = params;

    const sessionObject =
      payloadOverride ??
      ({
        id: sessionId,
        object: 'checkout.session',
      } satisfies Partial<Stripe.Checkout.Session>);

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
      data: {
        userId,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.PENDING,
        payments: {
          create: {
            externalId: sessionId,
            amount: 1000,
            planId: 'business_monthly',
            status: PaymentStatus.PENDING,
          },
        },
      },
      include: {
        payments: true,
      },
    });

    return {
      customer,
      subscription,
    };
  }

  describe('supports', () => {
    it('возвращает false для неподдерживаемого типа события', () => {
      const event = {
        id: 'evt_other',
        object: 'event',
        type: StripeEvents.CheckoutSessionCompleted,
        data: {
          object: {},
        },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для checkout.session.expired', () => {
      const event = {
        id: 'evt_expired',
        object: 'event',
        type: StripeEvents.CheckoutSessionExpired,
        data: {
          object: {},
        },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('возвращает BadRequest, если payload не является checkout.session', async () => {
      const event = makeCheckoutSessionExpiredEvent({
        sessionId: 'cs_invalid_payload',
        payloadOverride: {
          id: 'in_1',
          object: 'invoice',
        },
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.BadRequest);

      expect(await prisma.payment.count()).toBe(0);

      expect(await prisma.subscription.count()).toBe(0);
    });

    it('возвращает InternalServerError, если платеж не найден', async () => {
      const event = makeCheckoutSessionExpiredEvent({
        sessionId: 'cs_missing',
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);
    });

    it('возвращает InternalServerError, если cancelSubscription вернул null', async () => {
      const sessionId = 'cs_cancel_null';

      await seedPendingCheckout(sessionId, 100);

      jest.spyOn(subscriptionsRepository, 'cancelSubscription').mockResolvedValueOnce(null);

      const event = makeCheckoutSessionExpiredEvent({
        sessionId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const payment = await prisma.payment.findFirst({
        where: {
          externalId: sessionId,
        },
      });

      expect(payment?.status).toBe(PaymentStatus.FAILED);

      const sub = await prisma.subscription.findFirst();

      expect(sub?.status).toBe(SubscriptionStatus.PENDING);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError, если customer не найден', async () => {
      const sessionId = 'cs_no_customer';

      await seedPendingCheckout(sessionId, 101);

      jest.spyOn(customersRepository, 'findById').mockResolvedValueOnce(null);

      const event = makeCheckoutSessionExpiredEvent({
        sessionId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const payment = await prisma.payment.findFirst({
        where: {
          externalId: sessionId,
        },
      });

      /**
       * Транзакция должна откатиться,
       * так как handle вернул Notification.fail внутри tx callback
       */
      expect(payment?.status).toBe(PaymentStatus.FAILED);

      const sub = await prisma.subscription.findFirst();

      expect(sub?.status).toBe(SubscriptionStatus.CANCELLED);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Позитивный сценарий', () => {
    it('помечает платеж FAILED, подписку CANCELLED и создает outbox event', async () => {
      const sessionId = 'cs_expired_happy';

      const userId = 42;

      const eventCreated = 1_726_531_200;

      const { customer, subscription } = await seedPendingCheckout(sessionId, userId);

      const event = makeCheckoutSessionExpiredEvent({
        sessionId,
        created: eventCreated,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({
        where: {
          subscriptionId: subscription.id,
        },
      });

      expect(payment?.status).toBe(PaymentStatus.FAILED);

      const updatedSub = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(updatedSub?.status).toBe(SubscriptionStatus.CANCELLED);

      expect(updatedSub?.autoRenewal).toBe(false);

      expect(updatedSub?.lastStripeEventAt?.toISOString()).toBe(
        new Date(eventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.CHECKOUT_SESSION_EXPIRED,
        },
      });

      expect(outbox).toBeDefined();

      expect(outbox?.payload).toEqual({
        userId: customer.userId,
        planId: 'business_monthly',
        description: 'checkout session expired',
      });
    });
  });
});
