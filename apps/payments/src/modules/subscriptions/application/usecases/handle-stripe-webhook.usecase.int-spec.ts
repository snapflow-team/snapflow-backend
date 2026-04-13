import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import {
  OutboxEvent,
  OutboxEventType,
  PaymentStatus,
  Subscription,
  SubscriptionStatus,
} from '@generated/prisma-payments';
import { Notification } from '../../../../common/notification/notification';
import { PaymentsModule } from '../../../../payments.module';
import { PrismaService } from '../../../database/prisma.service';
import { StripeService } from '../services/stripe.service';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { HandleStripeWebhookCommand, HandleStripeWebhookUseCase, } from './handle-stripe-webhook.usecase';
import { StripeEvents } from '../constants/stripe-events.constants';
import { BillingPeriod } from '../types/billing-period.type';

describe('HandleStripeWebhookUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: HandleStripeWebhookUseCase;
  let prisma: PrismaService;

  const constructEventMock = jest.fn();
  const retrieveSubscriptionBillingPeriodMock = jest.fn();

  const redisMock = {
    get: jest.fn<Promise<string | null>, [string]>(),
    set: jest.fn<Promise<'OK' | null>, [string, string, string, number]>(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({
        constructEvent: constructEventMock,
        retrieveSubscriptionBillingPeriod: retrieveSubscriptionBillingPeriodMock,
        getBillingPeriodFromSubscriptionObject: jest.fn(),
        createCheckoutSession: jest.fn(),
      })
      .overrideProvider(REDIS_CLIENT_INJECT_TOKEN)
      .useValue(redisMock)
      .compile();

    useCase = module.get<HandleStripeWebhookUseCase>(HandleStripeWebhookUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, payments, subscriptions RESTART IDENTITY CASCADE',
    );

    constructEventMock.mockReset();
    retrieveSubscriptionBillingPeriodMock.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockResolvedValue(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  function makeCheckoutCompletedEvent(
    sessionId: string,
    stripeSubscriptionId: string,
  ): Stripe.Event {
    return {
      id: 'evt_test_1',
      object: 'event',
      type: StripeEvents.CheckoutSessionCompleted,
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          subscription: stripeSubscriptionId,
        } as Stripe.Checkout.Session,
      },
    } as Stripe.Event;
  }

  function makeInvoicePaymentFailedEvent(params: {
    eventId: string;
    stripeSubscriptionRef?: string | Stripe.Subscription;
    invoiceId?: string;
    attemptCount?: number;
    nextPaymentAttempt?: number | null;
    failureCode?: string | null;
    failureMessage?: string | null;
  }): Stripe.Event {
    const {
      eventId,
      stripeSubscriptionRef,
      invoiceId = 'in_test_1',
      attemptCount = 3,
      nextPaymentAttempt = 1_767_225_600,
      failureCode = 'card_declined',
      failureMessage = 'Your card was declined.',
    } = params;

    const invoiceObject = {
      id: invoiceId,
      object: 'invoice',
      attempt_count: attemptCount,
      next_payment_attempt: nextPaymentAttempt,
      last_finalization_error:
        failureCode || failureMessage
          ? {
              code: failureCode,
              message: failureMessage,
            }
          : null,
      parent: {
        subscription_details: {
          subscription: stripeSubscriptionRef,
        },
      },
    } as unknown as Stripe.Invoice;

    return {
      id: eventId,
      object: 'event',
      type: StripeEvents.InvoicePaymentFailed,
      data: {
        object: invoiceObject,
      },
    } as Stripe.Event;
  }

  it('checkout.session.completed: активирует подписку, пишет outbox PAYMENT_COMPLETED с currentPeriodEnd', async () => {
    const sessionId = 'cs_test_session_1';
    const stripeSubId = 'sub_test_1';
    const periodStart = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = new Date('2026-02-01T00:00:00.000Z');

    const subscription: Subscription = await prisma.subscription.create({
      data: {
        userId: 42,
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

    constructEventMock.mockReturnValue(
      Notification.ok(makeCheckoutCompletedEvent(sessionId, stripeSubId)),
    );

    const billingPeriod: BillingPeriod = { start: periodStart, end: periodEnd };

    retrieveSubscriptionBillingPeriodMock.mockResolvedValue(Notification.ok(billingPeriod));

    const result: Notification<void> = await useCase.execute(
      new HandleStripeWebhookCommand({ rawBody: Buffer.from('{}'), signature: 'sig' }),
    );

    expect(result.hasErrors).toBe(false);

    const updated: Subscription | null = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });

    expect(updated?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(updated?.stripeSubId).toBe(stripeSubId);
    expect(updated?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
    expect(updated?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());

    const outbox = await prisma.outboxEvent.findFirst({
      where: { type: OutboxEventType.PAYMENT_COMPLETED },
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

    expect(redisMock.set).toHaveBeenCalled();
  });

  it('invoice.payment_failed: создаёт PAYMENT_FAILED c контекстом ошибки', async () => {
    const stripeSubId = 'sub_invoice_failed_1';

    const subscription: Subscription = await prisma.subscription.create({
      data: {
        userId: 7,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
      },
    });

    const nextPaymentAttempt = 1_767_225_600; // 2026-01-31T00:00:00.000Z
    const event = makeInvoicePaymentFailedEvent({
      eventId: 'evt_invoice_failed_1',
      invoiceId: 'in_test_failed_1',
      stripeSubscriptionRef: stripeSubId,
      attemptCount: 2,
      nextPaymentAttempt,
      failureCode: 'insufficient_funds',
      failureMessage: 'Not enough funds.',
    });

    constructEventMock.mockReturnValue(Notification.ok(event));

    const result: Notification<void> = await useCase.execute(
      new HandleStripeWebhookCommand({ rawBody: Buffer.from('{}'), signature: 'sig' }),
    );

    expect(result.hasErrors).toBe(false);

    const outbox: OutboxEvent | null = await prisma.outboxEvent.findFirst({
      where: { type: OutboxEventType.PAYMENT_FAILED },
    });

    expect(outbox?.payload).toEqual(
      expect.objectContaining({
        userId: 7,
        planId: 'business_monthly',
        subscriptionId: subscription.id,
        stripeInvoiceId: 'in_test_failed_1',
        attemptCount: 2,
        nextPaymentAttempt: new Date(nextPaymentAttempt * 1000).toISOString(),
        failureCode: 'insufficient_funds',
        failureMessage: 'Not enough funds.',
      }),
    );

    expect(redisMock.set).toHaveBeenCalledWith(
      'stripe_webhook_processed:evt_invoice_failed_1',
      '1',
      'EX',
      86400,
    );
  });

  it('invoice.payment_failed: без subscription id ничего не пишет в outbox, но подтверждает событие', async () => {
    const event = makeInvoicePaymentFailedEvent({
      eventId: 'evt_invoice_failed_no_sub',
      stripeSubscriptionRef: undefined,
      invoiceId: 'in_test_no_sub',
      failureCode: null,
      failureMessage: null,
    });

    constructEventMock.mockReturnValue(Notification.ok(event));

    const result: Notification<void> = await useCase.execute(
      new HandleStripeWebhookCommand({ rawBody: Buffer.from('{}'), signature: 'sig' }),
    );

    expect(result.hasErrors).toBe(false);

    const outbox: OutboxEvent[] = await prisma.outboxEvent.findMany({
      where: { type: OutboxEventType.PAYMENT_FAILED },
    });
    expect(outbox).toHaveLength(0);

    expect(redisMock.set).toHaveBeenCalledWith(
      'stripe_webhook_processed:evt_invoice_failed_no_sub',
      '1',
      'EX',
      86400,
    );
  });
});
