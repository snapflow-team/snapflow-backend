import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { CustomerSubscriptionDeletedHandler } from './customer-subscription-deleted-handler';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { CustomersRepository } from '../../../infrastructure/customers.repository';
import { SubscriptionsRepository } from '../../../infrastructure/subscriptions.repository';

describe('CustomerSubscriptionDeletedHandler (Integration)', () => {
  let module: TestingModule;
  let handler: CustomerSubscriptionDeletedHandler;
  let prisma: PrismaService;

  let customersRepository: CustomersRepository;
  let subscriptionsRepository: SubscriptionsRepository;

  const defaultEventCreated = 1_704_067_200;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    }).compile();

    handler = module.get<CustomerSubscriptionDeletedHandler>(CustomerSubscriptionDeletedHandler);

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

  function makeSubscriptionDeletedEvent(params: {
    stripeSubscriptionId: string;
    created?: number;
    canceledAt?: number | null;
    payloadOverride?: unknown;
  }): Stripe.Event {
    const {
      stripeSubscriptionId,
      created = defaultEventCreated,
      canceledAt = 1_735_689_600,
      payloadOverride,
    } = params;

    const subscriptionObject =
      payloadOverride ??
      ({
        id: stripeSubscriptionId,
        object: 'subscription',
        canceled_at: canceledAt,
      } as Stripe.Subscription);

    return {
      id: 'evt_subscription_deleted',
      object: 'event',
      created,
      type: StripeEvents.SubscriptionDeleted,
      data: {
        object: subscriptionObject,
      },
    } as Stripe.Event;
  }

  async function seedActiveSubscription(stripeSubId: string, userId: number) {
    const customer = await prisma.customer.create({
      data: {
        userId,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
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
        type: StripeEvents.InvoicePaymentSucceeded,
        data: {
          object: {},
        },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для customer.subscription.deleted', () => {
      const event = {
        id: 'evt_subscription_deleted',
        object: 'event',
        type: StripeEvents.SubscriptionDeleted,
        data: {
          object: {},
        },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('возвращает BadRequest, если payload не является subscription object', async () => {
      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: 'sub_1',
        payloadOverride: {
          id: 'in_1',
          object: 'invoice',
        },
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.BadRequest);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError, если локальная подписка не найдена', async () => {
      await seedActiveSubscription('sub_local', 10);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: 'sub_unknown',
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError для старого события', async () => {
      const stripeSubId = 'sub_old_event';

      const { subscription } = await seedActiveSubscription(stripeSubId, 20);

      const eventTime = new Date('2024-01-01T00:00:00.000Z');

      const eventCreated = Math.floor(eventTime.getTime() / 1000);

      await prisma.subscription.update({
        where: {
          id: subscription.id,
        },
        data: {
          lastStripeEventAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      });

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
        created: eventCreated,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const unchanged = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(unchanged?.status).toBe(SubscriptionStatus.ACTIVE);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError, если canceled_at отсутствует', async () => {
      const stripeSubId = 'sub_no_cancelled_at';

      await seedActiveSubscription(stripeSubId, 30);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
        canceledAt: null,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const sub = await prisma.subscription.findFirst({
        where: {
          stripeSubId,
        },
      });

      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError, если cancelSubscription вернул null', async () => {
      const stripeSubId = 'sub_cancel_null';

      const { subscription } = await seedActiveSubscription(stripeSubId, 40);

      jest.spyOn(subscriptionsRepository, 'cancelSubscription').mockResolvedValueOnce(null);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const unchanged = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(unchanged?.status).toBe(SubscriptionStatus.ACTIVE);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('возвращает InternalServerError, если customer не найден', async () => {
      const stripeSubId = 'sub_customer_missing';

      const { subscription } = await seedActiveSubscription(stripeSubId, 50);

      jest.spyOn(customersRepository, 'findById').mockResolvedValueOnce(null);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);

      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const unchanged = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(unchanged?.status).toBe(SubscriptionStatus.CANCELLED);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Позитивный сценарий', () => {
    it('отменяет подписку и создает outbox event SUBSCRIPTION_CANCELLED', async () => {
      const stripeSubId = 'sub_deleted_happy';

      const userId = 9002;

      const canceledAtUnix = 1_735_689_600;

      const expectedCancelledAt = new Date(canceledAtUnix * 1000).toISOString();

      const eventCreated = 1_726_531_200;

      const { customer, subscription } = await seedActiveSubscription(stripeSubId, userId);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
        created: eventCreated,
        canceledAt: canceledAtUnix,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(updated?.status).toBe(SubscriptionStatus.CANCELLED);

      expect(updated?.autoRenewal).toBe(false);

      expect(updated?.lastStripeEventAt?.toISOString()).toBe(
        new Date(eventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_CANCELLED,
        },
      });

      expect(outbox).toBeDefined();

      console.log('outbox payload: ', outbox?.payload);

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.userId,
          planId: 'business_monthly',
          subscriptionId: subscription.id,
          cancelledAt: expectedCancelledAt,
        }),
      );
    });
  });
});
