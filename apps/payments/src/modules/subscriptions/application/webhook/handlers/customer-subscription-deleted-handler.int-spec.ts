import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { OutboxEventType, SubscriptionStatus } from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { CustomerSubscriptionDeletedHandler } from './customer-subscription-deleted-handler';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';

describe('CustomerSubscriptionDeletedHandler (Integration)', () => {
  let module: TestingModule;
  let handler: CustomerSubscriptionDeletedHandler;
  let prisma: PrismaService;

  const defaultEventCreated = 1_704_067_200;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    }).compile();

    handler = module.get<CustomerSubscriptionDeletedHandler>(CustomerSubscriptionDeletedHandler);
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
      data: { userId },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
      },
    });

    return { customer, subscription };
  }

  describe('supports', () => {
    it('возвращает false для события другого типа', () => {
      const event = {
        id: 'evt_other',
        object: 'event',
        type: StripeEvents.InvoicePaymentSucceeded,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для customer.subscription.deleted', () => {
      const event = {
        id: 'evt_1',
        object: 'event',
        type: StripeEvents.SubscriptionDeleted,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('BadRequest, если data.object не subscription', async () => {
      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: 'sub_1',
        payloadOverride: {
          id: 'in_1',
          object: 'invoice',
        },
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('InternalServerError, если локальной подписки с stripeSubId нет', async () => {
      await seedActiveSubscription('sub_local', 10);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: 'sub_unknown',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('InternalServerError при старом событии (lastStripeEventAt позже event.created): отмена и outbox не выполняются', async () => {
      const stripeSubId = 'sub_old_event';
      const { subscription } = await seedActiveSubscription(stripeSubId, 20);

      const eventTime = new Date('2024-01-01T00:00:00.000Z');
      const eventCreated = Math.floor(eventTime.getTime() / 1000);

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          lastStripeEventAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      });

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
        created: eventCreated,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const unchanged = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(unchanged?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('InternalServerError, если canceled_at отсутствует / null', async () => {
      const stripeSubId = 'sub_no_canceled_at';
      await seedActiveSubscription(stripeSubId, 30);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
        canceledAt: null,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      const sub = await prisma.subscription.findFirst({ where: { stripeSubId } });
      expect(sub?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Позитивный сценарий', () => {
    it('подписка отменена, lastStripeEventAt из события, outbox SUBSCRIPTION_CANCELLED с cancelledAt из Stripe', async () => {
      const stripeSubId = 'sub_deleted_happy';
      const userId = 9_002;
      const canceledAtUnix = 1_735_689_600;
      const expectedCancelledAt = new Date(canceledAtUnix * 1000);
      const eventCreated = 1_726_531_200;

      const { customer, subscription } = await seedActiveSubscription(stripeSubId, userId);

      const event = makeSubscriptionDeletedEvent({
        stripeSubscriptionId: stripeSubId,
        created: eventCreated,
        canceledAt: canceledAtUnix,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updated?.status).toBe(SubscriptionStatus.CANCELLED);
      expect(updated?.autoRenewal).toBe(false);
      expect(updated?.lastStripeEventAt?.toISOString()).toBe(
        new Date(eventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_CANCELLED },
      });
      expect(outbox).toBeDefined();
      /** Контракт поля `userId`; в payload сейчас передаётся id строки customers (как в других outbox-хендлерах). */
      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.id,
          planId: 'business_monthly',
          subscriptionId: subscription.id,
          cancelledAt: expectedCancelledAt.toISOString(),
        }),
      );
    });
  });
});
