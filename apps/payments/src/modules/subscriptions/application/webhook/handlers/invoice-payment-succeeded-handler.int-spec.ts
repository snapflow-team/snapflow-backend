import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import {
  OutboxEventType,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
} from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { InvoicePaymentSucceededHandler } from './invoice-payment-succeeded-handler';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { Notification } from '../../../../../common/notification/notification';
import { StripeService } from '../../services/stripe.service';

describe('InvoicePaymentSucceededHandler (Integration)', () => {
  let module: TestingModule;
  let handler: InvoicePaymentSucceededHandler;
  let prisma: PrismaService;

  const defaultEventCreated = 1_704_067_200;

  const retrieveSubscriptionBillingPeriodMock = jest.fn();
  const retrieveSucceededPaymentFromInvoiceMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      .overrideProvider(StripeService)
      .useValue({
        retrieveSubscriptionBillingPeriod: retrieveSubscriptionBillingPeriodMock,
        retrieveSucceededPaymentFromInvoice: retrieveSucceededPaymentFromInvoiceMock,
      })
      .compile();

    handler = module.get(InvoicePaymentSucceededHandler);
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE',
    );

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  async function executeHandler(event: Stripe.Event) {
    return prisma.$transaction((tx) => handler.handle(event, tx));
  }

  function makeInvoicePaymentSucceededEvent(params: {
    eventId?: string;
    created?: number;
    billingReason?: Stripe.Invoice.BillingReason | null;
    stripeSubscriptionRef?: string | Stripe.Subscription | null;
    invoiceId?: string;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
    payloadOverride?: unknown;
  }): Stripe.Event {
    const {
      eventId = 'evt_invoice_succeeded',
      created = defaultEventCreated,
      billingReason = 'subscription_cycle',
      stripeSubscriptionRef,
      invoiceId = 'in_test_succeeded_1',
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
        customer,
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
      type: StripeEvents.InvoicePaymentSucceeded,
      data: { object: invoiceObject },
    } as Stripe.Event;
  }

  async function seedSubscription() {
    const customer = await prisma.customer.create({
      data: { userId: 1, stripeCusId: 'cus_1' },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        stripeSubId: 'sub_1',
        currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
      },
    });

    return { customer, subscription };
  }

  describe('supports', () => {
    it('возвращает false для другого события', () => {
      const event = {
        id: 'evt_other',
        object: 'event',
        type: StripeEvents.CheckoutSessionCompleted,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для invoice.payment_succeeded', () => {
      const event = {
        id: 'evt_1',
        object: 'event',
        type: StripeEvents.InvoicePaymentSucceeded,
        data: { object: {} },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('BadRequest если payload не invoice', async () => {
      const event = makeInvoicePaymentSucceededEvent({
        payloadOverride: { id: 'x', object: 'subscription' },
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Пропуски обработки', () => {
    it('skip если billing_reason не subscription_cycle', async () => {
      await seedSubscription();

      const event = makeInvoicePaymentSucceededEvent({
        billingReason: 'subscription_create',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
    });

    it('skip если нет subscription id', async () => {
      const event = makeInvoicePaymentSucceededEvent({
        stripeSubscriptionRef: null,
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('skip если нет локальной подписки', async () => {
      const event = makeInvoicePaymentSucceededEvent({
        stripeSubscriptionRef: 'sub_unknown',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);
      expect(await prisma.outboxEvent.count()).toBe(0);
    });
  });

  describe('Позитивный сценарий', () => {
    it('успешное продление подписки + платеж + outbox', async () => {
      const { customer, subscription } = await seedSubscription();

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: new Date('2026-02-01T00:00:00.000Z'),
          end: new Date('2026-03-01T00:00:00.000Z'),
        }),
      );

      retrieveSucceededPaymentFromInvoiceMock.mockResolvedValue(
        Notification.ok({
          amount: 2500,
          currency: 'usd',
          status: PaymentStatus.PAID,
          provider: PaymentProvider.STRIPE,
        }),
      );

      const event = makeInvoicePaymentSucceededEvent({
        stripeSubscriptionRef: subscription.stripeSubId,
        customer: customer.stripeCusId,
        invoiceId: 'in_1',
      });

      const result = await executeHandler(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({
        where: { id: subscription.id },
      });

      expect(updated?.status).toBe(SubscriptionStatus.ACTIVE);

      const payment = await prisma.payment.findFirst({
        where: { subscriptionId: subscription.id },
      });

      expect(payment?.status).toBe(PaymentStatus.PAID);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_RENEWED },
      });

      expect(outbox).toBeDefined();
      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.userId,
          subscriptionId: subscription.id,
        }),
      );
    });
  });
});
