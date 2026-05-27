import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import {
  InboxEventStatus,
  OutboxCommandStatus,
  OutboxCommandType,
  OutboxEvent,
  OutboxEventType,
  PaymentProvider,
  PaymentStatus,
  Subscription,
  SubscriptionStatus,
} from '@generated/prisma-payments';
import { Notification } from '../../../common/notification/notification';
import { PaymentsModule } from '../../../payments.module';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from '../../subscriptions/application/services/stripe.service';
import { InboxProcessorService } from './inbox-processor.service';
import { StripeEvents } from '../../subscriptions/application/constants/stripe-events.constants';
import { BillingPeriod } from '../../subscriptions/application/types/billing-period.type';
import { StripeCSModes } from '../../subscriptions/application/services/types/stripe-checkout-session-modes.enum';

const TRUNCATE_SQL =
  'TRUNCATE TABLE inbox_events, outbox_commands, outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE';

describe('InboxProcessorService (Integration)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let inboxProcessor: InboxProcessorService;

  const retrieveSubscriptionBillingPeriodMock = jest.fn();
  const getSubscriptionMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({
        constructEvent: jest.fn(),
        retrieveSubscriptionBillingPeriod: retrieveSubscriptionBillingPeriodMock,
        getSubscription: getSubscriptionMock,
        getBillingPeriodFromSubscriptionObject: jest.fn(),
        createCheckoutSession: jest.fn(),
        extendSubscription: jest.fn(),
      })
      .compile();

    prisma = module.get(PrismaService);
    inboxProcessor = module.get(InboxProcessorService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE_SQL);

    retrieveSubscriptionBillingPeriodMock.mockReset();
    getSubscriptionMock.mockReset();
    getSubscriptionMock.mockResolvedValue({
      id: 'sub_default',
      customer: 'cus_default',
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  async function insertInboxEvent(event: Stripe.Event): Promise<void> {
    await prisma.inboxEvent.create({
      data: {
        eventId: event.id,
        provider: PaymentProvider.STRIPE,
        payload: event as object,
        status: InboxEventStatus.PENDING,
      },
    });
  }

  function makeCheckoutCompletedEvent(params: {
    eventId: string;
    sessionId: string;
    stripeSubscriptionId: string;
    mode: StripeCSModes;
    metadata?: Record<string, string>;
  }): Stripe.Event {
    const { eventId, sessionId, stripeSubscriptionId, mode, metadata } = params;

    return {
      id: eventId,
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      type: StripeEvents.CheckoutSessionCompleted,
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          mode,
          subscription: stripeSubscriptionId,
          ...(metadata ? { metadata } : {}),
        } as Stripe.Checkout.Session,
      },
    } as Stripe.Event;
  }

  it('checkout.session.completed (subscription): обрабатывает inbox → PROCESSED и пишет outbox SUBSCRIPTION_ACTIVATED', async () => {
    const sessionId = 'cs_inbox_sub_1';
    const stripeSubId = 'sub_inbox_sub_1';
    const periodStart = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = new Date('2026-02-01T00:00:00.000Z');

    const customer = await prisma.customer.create({ data: { userId: 42 } });

    const subscription: Subscription = await prisma.subscription.create({
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
    });

    const event = makeCheckoutCompletedEvent({
      eventId: 'evt_inbox_sub_1',
      sessionId,
      stripeSubscriptionId: stripeSubId,
      mode: StripeCSModes.Subscription,
    });

    await insertInboxEvent(event);

    retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
      Notification.ok({ start: periodStart, end: periodEnd } satisfies BillingPeriod),
    );

    getSubscriptionMock.mockResolvedValue({
      id: stripeSubId,
      customer: 'cus_inbox_sub_1',
    });

    await inboxProcessor.processInboxEvents();

    const inbox = await prisma.inboxEvent.findUnique({ where: { eventId: event.id } });
    expect(inbox?.status).toBe(InboxEventStatus.PROCESSED);
    expect(inbox?.processedAt).toBeDefined();

    const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    expect(updated?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(updated?.stripeSubId).toBe(stripeSubId);
    expect(updated?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
    expect(updated?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());

    const outbox = await prisma.outboxEvent.findFirst({
      where: { type: OutboxEventType.SUBSCRIPTION_ACTIVATED },
    });

    expect(outbox).toBeDefined();
    expect(outbox?.payload).toEqual(
      expect.objectContaining({
        userId: 42,
        planId: 'business_monthly',
        subscriptionId: subscription.id,
        currentPeriodEnd: periodEnd.toISOString(),
      }),
    );

    const outboxCommands = await prisma.outboxCommand.findMany();
    expect(outboxCommands).toHaveLength(0);
  });

  it('checkout.session.completed (payment): PROCESSED, outbox SUBSCRIPTION_RENEWED и outbox_commands STRIPE_EXTEND_SUBSCRIPTION', async () => {
    const sessionId = 'cs_inbox_pay_1';
    const stripeSubId = 'sub_inbox_pay_1';
    const periodStart = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = new Date('2026-02-01T00:00:00.000Z');

    const customer = await prisma.customer.create({ data: { userId: 99 } });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
        currentPeriodEnd: periodEnd,
        payments: {
          create: {
            planId: 'business_monthly',
            externalId: sessionId,
            amount: 1000,
            status: PaymentStatus.PENDING,
          },
        },
      },
    });

    const event = makeCheckoutCompletedEvent({
      eventId: 'evt_inbox_pay_1',
      sessionId,
      stripeSubscriptionId: stripeSubId,
      mode: StripeCSModes.Payment,
      metadata: { subscriptionDuration: '30' },
    });

    await insertInboxEvent(event);

    retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
      Notification.ok({ start: periodStart, end: periodEnd } satisfies BillingPeriod),
    );

    getSubscriptionMock.mockResolvedValue({
      id: stripeSubId,
      customer: 'cus_inbox_pay_1',
    });

    await inboxProcessor.processInboxEvents();

    const inbox = await prisma.inboxEvent.findUnique({ where: { eventId: event.id } });
    expect(inbox?.status).toBe(InboxEventStatus.PROCESSED);

    const payment = await prisma.payment.findFirst({
      where: { subscriptionId: subscription.id },
    });
    expect(payment?.status).toBe(PaymentStatus.PAID);

    const outbox = await prisma.outboxEvent.findFirst({
      where: { type: OutboxEventType.SUBSCRIPTION_RENEWED },
    });
    expect(outbox).toBeDefined();

    const outboxCommand = await prisma.outboxCommand.findFirst({
      where: { type: OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION },
    });

    expect(outboxCommand).toBeDefined();
    expect(outboxCommand?.status).toBe(OutboxCommandStatus.PENDING);
    expect(outboxCommand?.payload).toEqual(
      expect.objectContaining({
        stripeSubscriptionId: stripeSubId,
        newEndIso: expect.any(String),
      }),
    );
  });

  it('invoice.payment_failed: PROCESSED и outbox SUBSCRIPTION_RENEWAL_FAILED', async () => {
    const stripeSubId = 'sub_invoice_inbox_1';
    const stripeCusId = 'cus_invoice_inbox_1';

    const customer = await prisma.customer.create({
      data: { userId: 7, stripeCusId },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
      },
    });

    const nextPaymentAttempt = 1_767_225_600;
    const event = {
      id: 'evt_invoice_inbox_1',
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      type: StripeEvents.InvoicePaymentFailed,
      data: {
        object: {
          id: 'in_test_inbox_1',
          object: 'invoice',
          billing_reason: 'subscription_cycle',
          customer: stripeCusId,
          attempt_count: 2,
          next_payment_attempt: nextPaymentAttempt,
          last_finalization_error: {
            code: 'insufficient_funds',
            message: 'Not enough funds.',
          },
          parent: {
            subscription_details: {
              subscription: stripeSubId,
            },
          },
        },
      },
    } as Stripe.Event;

    await insertInboxEvent(event);

    await inboxProcessor.processInboxEvents();

    const inbox = await prisma.inboxEvent.findUnique({ where: { eventId: event.id } });
    expect(inbox?.status).toBe(InboxEventStatus.PROCESSED);

    const outbox: OutboxEvent | null = await prisma.outboxEvent.findFirst({
      where: { type: OutboxEventType.SUBSCRIPTION_RENEWAL_FAILED },
    });

    expect(outbox?.payload).toEqual(
      expect.objectContaining({
        userId: 7,
        planId: 'business_monthly',
        subscriptionId: subscription.id,
        stripeInvoiceId: 'in_test_inbox_1',
        attemptCount: 2,
        nextPaymentAttempt: new Date(nextPaymentAttempt * 1000).toISOString(),
        failureCode: 'insufficient_funds',
        failureMessage: 'Not enough funds.',
      }),
    );
  });
});
