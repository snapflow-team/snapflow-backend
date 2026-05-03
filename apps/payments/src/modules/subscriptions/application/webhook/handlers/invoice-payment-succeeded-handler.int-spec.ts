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
import { BillingPeriod } from '../../types/billing-period.type';
import { InvoicePayment } from '../../types/invoice-payment.type';
import { CustomersRepository } from '../../../infrastructure/customers.repository';

describe('InvoicePaymentSucceededHandler (Integration)', () => {
  let module: TestingModule;
  let handler: InvoicePaymentSucceededHandler;
  let prisma: PrismaService;
  let customersRepository: CustomersRepository;

  const defaultEventCreated = 1_704_067_200; // 2023-11-27T00:00:00.000Z

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

    handler = module.get<InvoicePaymentSucceededHandler>(InvoicePaymentSucceededHandler);
    prisma = module.get<PrismaService>(PrismaService);
    customersRepository = module.get<CustomersRepository>(CustomersRepository);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE outbox_events, payments, subscriptions, customers RESTART IDENTITY CASCADE',
    );
    retrieveSubscriptionBillingPeriodMock.mockReset();
    retrieveSucceededPaymentFromInvoiceMock.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  function makeInvoicePaymentSucceededEvent(params: {
    eventId?: string;
    created?: number;
    /** по умолчанию subscription_cycle (продление) */
    billingReason?: Stripe.Invoice.BillingReason | null;
    /** по умолчанию sub_default; null — без subscription (пропуск по id) */
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
    periodStart?: Date;
    periodEnd?: Date;
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
        currentPeriodStart: params.periodStart ?? new Date('2026-01-01T00:00:00.000Z'),
        currentPeriodEnd: params.periodEnd ?? new Date('2026-02-01T00:00:00.000Z'),
      },
    });

    return { customer, subscription };
  }

  const sampleInvoicePayment = (): InvoicePayment => ({
    amount: 2_500,
    currency: 'usd',
    status: PaymentStatus.PAID,
    provider: PaymentProvider.STRIPE,
  });

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
    it('BadRequest, если data.object не invoice', async () => {
      const event = makeInvoicePaymentSucceededEvent({
        payloadOverride: {
          id: 'sub_1',
          object: 'subscription',
        },
      });

      const result: Notification<void> = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
      expect(await prisma.outboxEvent.count()).toBe(0);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
    });

    it('ошибка retrieveSubscriptionBillingPeriod: copyErrors, без продления и outbox', async () => {
      const stripeSubId = 'sub_billing_err';
      const stripeCusId = 'cus_billing_err';
      const { subscription } = await seedRenewalContext({
        userId: 40,
        stripeSubId,
        stripeCusId,
      });

      const periodStart = subscription.currentPeriodStart!;
      const periodEnd = subscription.currentPeriodEnd!;

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.fail(NotificationResultCode.InternalServerError, 'Stripe billing error'),
      );

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_billing_fail',
        invoiceId: 'in_billing_fail',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
      expect(retrieveSucceededPaymentFromInvoiceMock).not.toHaveBeenCalled();
      expect(await prisma.outboxEvent.count()).toBe(0);
      expect(await prisma.payment.count()).toBe(0);

      const sub = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(sub?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
      expect(sub?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());
    });
  });

  describe('Пропуск обработки', () => {
    it('ok без изменений и outbox, если billing_reason не subscription_cycle', async () => {
      const stripeSubId = 'sub_skip_billing';
      const periodStart = new Date('2026-01-10T00:00:00.000Z');
      const periodEnd = new Date('2026-02-10T00:00:00.000Z');

      await seedRenewalContext({
        userId: 1,
        stripeSubId,
        stripeCusId: 'cus_skip',
        periodStart,
        periodEnd,
      });

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_skip_billing',
        billingReason: 'subscription_create',
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_skip',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
      expect(await prisma.outboxEvent.count()).toBe(0);

      const sub = await prisma.subscription.findFirst({ where: { stripeSubId } });
      expect(sub?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
      expect(sub?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());
    });

    it('ok без outbox, если из invoice не извлекается subscription id', async () => {
      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_no_sub_id',
        stripeSubscriptionRef: null,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('ok без outbox, если локальной подписки с stripeSubId нет', async () => {
      await seedRenewalContext({
        userId: 2,
        stripeSubId: 'sub_local_only',
        stripeCusId: 'cus_2',
      });

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_unknown_sub',
        stripeSubscriptionRef: 'sub_not_in_db',
        customer: 'cus_2',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('ok без изменений для старого события (lastStripeEventAt позже event.created)', async () => {
      const stripeSubId = 'sub_old_succeeded';
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

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_old_succeeded',
        created: eventCreated,
        stripeSubscriptionRef: stripeSubId,
        customer: 'cus_3',
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('ok без вызовов Stripe, если customer не найден по customerId подписки', async () => {
      const stripeSubId = 'sub_no_customer';
      const stripeCusId = 'cus_no_row';

      await seedRenewalContext({
        userId: 4,
        stripeSubId,
        stripeCusId,
      });

      const findByIdSpy = jest.spyOn(customersRepository, 'findById').mockResolvedValueOnce(null);

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_missing_customer',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
      });

      const result = await handler.handle(event);

      findByIdSpy.mockRestore();

      expect(result.hasErrors).toBe(false);
      expect(retrieveSubscriptionBillingPeriodMock).not.toHaveBeenCalled();
      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('ok при ошибке retrieveSucceededPaymentFromInvoice: период подписки и платежи не меняются', async () => {
      const stripeSubId = 'sub_payment_parse_warn';
      const stripeCusId = 'cus_parse_warn';

      const { subscription } = await seedRenewalContext({
        userId: 5,
        stripeSubId,
        stripeCusId,
      });

      const periodStart = subscription.currentPeriodStart!;
      const periodEnd = subscription.currentPeriodEnd!;

      const newPeriodEnd = new Date('2026-04-01T00:00:00.000Z');
      const newPeriodStart = new Date('2026-03-01T00:00:00.000Z');
      const billingPeriod: BillingPeriod = { start: newPeriodStart, end: newPeriodEnd };

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(Notification.ok(billingPeriod));
      retrieveSucceededPaymentFromInvoiceMock.mockResolvedValue(
        Notification.fail(NotificationResultCode.InternalServerError, 'invoice parse failed'),
      );

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_parse_fail',
        invoiceId: 'in_parse_fail',
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);
      expect(retrieveSubscriptionBillingPeriodMock).toHaveBeenCalledWith(stripeSubId);
      expect(retrieveSucceededPaymentFromInvoiceMock).toHaveBeenCalledWith('in_parse_fail');
      expect(await prisma.outboxEvent.count()).toBe(0);
      expect(await prisma.payment.count()).toBe(0);

      const sub = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(sub?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
      expect(sub?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());
    });
  });

  describe('Позитивные сценарии', () => {
    it('продление: обновляет период, создаёт PAID платёж, outbox SUBSCRIPTION_ACTIVATED', async () => {
      const stripeSubId = 'sub_renewal_ok';
      const stripeCusId = 'cus_renewal_ok';
      const userId = 42;
      const invoiceId = 'in_renewal_ok_1';

      const newPeriodStart = new Date('2026-02-01T00:00:00.000Z');
      const newPeriodEnd = new Date('2026-03-01T00:00:00.000Z');
      const billingPeriod: BillingPeriod = { start: newPeriodStart, end: newPeriodEnd };

      const { customer, subscription } = await seedRenewalContext({
        userId,
        stripeSubId,
        stripeCusId,
      });

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(Notification.ok(billingPeriod));
      retrieveSucceededPaymentFromInvoiceMock.mockResolvedValue(
        Notification.ok(sampleInvoicePayment()),
      );

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_renewal_ok',
        invoiceId,
        stripeSubscriptionRef: stripeSubId,
        customer: stripeCusId,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updated?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(updated?.currentPeriodStart?.toISOString()).toBe(newPeriodStart.toISOString());
      expect(updated?.currentPeriodEnd?.toISOString()).toBe(newPeriodEnd.toISOString());
      expect(updated?.lastStripeEventAt?.toISOString()).toBe(
        new Date(defaultEventCreated * 1000).toISOString(),
      );

      const payments = await prisma.payment.findMany({ where: { subscriptionId: subscription.id } });
      expect(payments).toHaveLength(1);
      expect(payments[0]?.amount).toBe(2_500);
      expect(payments[0]?.status).toBe(PaymentStatus.PAID);
      expect(payments[0]?.planId).toBe('business_monthly');

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_ACTIVATED },
      });

      expect(outbox?.payload).toEqual({
        userId: customer.userId,
        planId: 'business_monthly',
        subscriptionId: subscription.id,
        currentPeriodEnd: newPeriodEnd.toISOString(),
      });
    });

    it('subscription в parent как объект Stripe: извлекается id, успешное продление', async () => {
      const stripeSubId = 'sub_from_object';
      const stripeCusId = 'cus_obj_sub';

      const { subscription } = await seedRenewalContext({
        userId: 11,
        stripeSubId,
        stripeCusId,
      });

      const newPeriodEnd = new Date('2026-05-01T00:00:00.000Z');
      const newPeriodStart = new Date('2026-04-01T00:00:00.000Z');
      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({ start: newPeriodStart, end: newPeriodEnd }),
      );
      retrieveSucceededPaymentFromInvoiceMock.mockResolvedValue(
        Notification.ok(sampleInvoicePayment()),
      );

      const event = makeInvoicePaymentSucceededEvent({
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
      expect(await prisma.payment.count()).toBe(1);

      const updated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      expect(updated?.currentPeriodEnd?.toISOString()).toBe(newPeriodEnd.toISOString());
    });

    it('customer в invoice как расширенный объект: успех', async () => {
      const stripeSubId = 'sub_expanded_cus';
      const stripeCusId = 'cus_expanded_1';

      const { customer, subscription } = await seedRenewalContext({
        userId: 99,
        stripeSubId,
        stripeCusId,
      });

      const newPeriodEnd = new Date('2026-07-01T00:00:00.000Z');
      const newPeriodStart = new Date('2026-06-01T00:00:00.000Z');
      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({ start: newPeriodStart, end: newPeriodEnd }),
      );
      retrieveSucceededPaymentFromInvoiceMock.mockResolvedValue(
        Notification.ok(sampleInvoicePayment()),
      );

      const event = makeInvoicePaymentSucceededEvent({
        eventId: 'evt_expanded_customer',
        invoiceId: 'in_exp_cus',
        stripeSubscriptionRef: stripeSubId,
        customer: { id: stripeCusId, object: 'customer' } as Stripe.Customer,
      });

      const result = await handler.handle(event);

      expect(result.hasErrors).toBe(false);

      const outbox = await prisma.outboxEvent.findFirst({
        where: { type: OutboxEventType.SUBSCRIPTION_ACTIVATED },
      });

      expect(outbox?.payload).toEqual(
        expect.objectContaining({
          userId: customer.userId,
          subscriptionId: subscription.id,
          currentPeriodEnd: newPeriodEnd.toISOString(),
        }),
      );
    });
  });
});
