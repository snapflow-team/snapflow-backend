import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import {
  OutboxCommandType,
  OutboxEventType,
  PaymentStatus,
  SubscriptionStatus,
} from '@generated/prisma-payments';
import { PaymentsModule } from '../../../../../payments.module';
import { PrismaService } from '../../../../database/prisma.service';
import { StripeService } from '../../services/stripe.service';
import { StripeEvents } from '../../constants/stripe-events.constants';
import { CheckoutSessionCompletedHandler } from './checkout-session-completed-handler';
import { Notification } from '../../../../../common/notification/notification';
import { NotificationResultCode } from '../../../../../common/notification/notification-result-code';
import { StripeCSModes } from '../../services/types/stripe-checkout-session-modes.enum';

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
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        inbox_events,
        outbox_commands,
        outbox_events,
        payments,
        subscriptions,
        customers
      RESTART IDENTITY CASCADE
    `);

    retrieveSubscriptionBillingPeriodMock.mockReset();
    getSubscriptionMock.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  async function executeInTx(event: Stripe.Event) {
    return prisma.$transaction((tx) => handler.handle(event, tx));
  }

  function makeCheckoutCompletedEvent(params: {
    sessionId: string;
    mode?: Stripe.Checkout.Session.Mode;
    subscription?: string | Stripe.Subscription | null;
    metadata?: Record<string, string>;
    created?: number;
    payloadOverride?: unknown;
  }): Stripe.Event {
    const {
      sessionId,
      mode = StripeCSModes.Subscription,
      subscription,
      metadata,
      created = defaultEventCreated,
      payloadOverride,
    } = params;

    const sessionObject =
      payloadOverride ??
      ({
        id: sessionId,
        object: 'checkout.session',
        mode,
        metadata,
        subscription: subscription ?? 'sub_default',
      } satisfies Partial<Stripe.Checkout.Session>);

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
    it('возвращает false для события другого типа', () => {
      const event = {
        id: 'evt_other',
        object: 'event',
        type: StripeEvents.CheckoutSessionExpired,
        data: {
          object: {},
        },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(false);
    });

    it('возвращает true для checkout.session.completed', () => {
      const event = {
        id: 'evt_checkout',
        object: 'event',
        type: StripeEvents.CheckoutSessionCompleted,
        data: {
          object: {},
        },
      } as Stripe.Event;

      expect(handler.supports(event)).toBe(true);
    });
  });

  describe('Негативные сценарии', () => {
    it('BadRequest, если data.object не checkout.session', async () => {
      const event = makeCheckoutCompletedEvent({
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

    it('BadRequest, если у session нет subscription id', async () => {
      const event = makeCheckoutCompletedEvent({
        sessionId: 'cs_no_sub',
        payloadOverride: {
          id: 'cs_no_sub',
          object: 'checkout.session',
          mode: StripeCSModes.Subscription,
          subscription: null,
        },
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.BadRequest);
    });

    it('NotFound, если платёж с externalId = session.id не найден', async () => {
      const event = makeCheckoutCompletedEvent({
        sessionId: 'cs_missing_payment',
        subscription: 'sub_missing',
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
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

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);

      expect(retrieveSubscriptionBillingPeriodMock).toHaveBeenCalledWith(stripeSubId);

      const sub = await prisma.subscription.findFirst();

      expect(sub?.status).toBe(SubscriptionStatus.PENDING);

      const payment = await prisma.payment.findFirst();

      expect(payment?.status).toBe(PaymentStatus.PENDING);

      expect(await prisma.outboxEvent.count()).toBe(0);
    });

    it('пробрасывает InternalServerError если stripe subscription не найдена', async () => {
      const sessionId = 'cs_stripe_sub_fail';

      await seedPendingCheckout(sessionId, 501);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: new Date(),
          end: new Date(),
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.fail(NotificationResultCode.InternalServerError),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        subscription: 'sub_fail',
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
    });

    it('пробрасывает InternalServerError если stripe customer id не пришел в подписке', async () => {
      const sessionId = 'cs_no_customer';
      const stripeSubId = 'sub_no_customer';

      await seedPendingCheckout(sessionId, 600);

      const periodStart = new Date('2026-01-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-01T00:00:00.000Z');

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: periodStart,
          end: periodEnd,
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: stripeSubId,
          object: 'subscription',
          customer: null,
        } as unknown as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        subscription: stripeSubId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
    });

    it('пробрасывает InternalServerError if metadata для продления подписки отсутствует', async () => {
      const sessionId = 'cs_no_metadata';

      await seedPendingCheckout(sessionId, 700);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: new Date(),
          end: new Date(),
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: 'sub_1',
          object: 'subscription',
          customer: 'cus_1',
        } as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        mode: StripeCSModes.Payment,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(true);
      expect(result.code).toBe(NotificationResultCode.InternalServerError);
    });
  });

  describe('Subscription activation', () => {
    it('хранит stripe customer id когда customer строка', async () => {
      const sessionId = 'cs_cus_string';
      const stripeSubId = 'sub_cus_string';
      const stripeCusId = 'cus_string';

      const { customer } = await seedPendingCheckout(sessionId, 800);

      const periodStart = new Date('2026-03-01T00:00:00.000Z');
      const periodEnd = new Date('2026-04-01T00:00:00.000Z');

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: periodStart,
          end: periodEnd,
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: stripeSubId,
          object: 'subscription',
          customer: stripeCusId,
        } as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        mode: StripeCSModes.Subscription,
        subscription: stripeSubId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);

      const updatedCustomer = await prisma.customer.findUnique({
        where: {
          id: customer.id,
        },
      });

      expect(updatedCustomer?.stripeCusId).toBe(stripeCusId);
    });

    it('сохранит stripe customer id когда customer это expanded object', async () => {
      const sessionId = 'cs_cus_object';
      const stripeSubId = 'sub_cus_object';
      const stripeCusId = 'cus_object';

      const { customer } = await seedPendingCheckout(sessionId, 801);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: new Date('2026-03-01T00:00:00.000Z'),
          end: new Date('2026-04-01T00:00:00.000Z'),
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: stripeSubId,
          object: 'subscription',
          customer: {
            id: stripeCusId,
            object: 'customer',
          } as Stripe.Customer,
        } as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        mode: StripeCSModes.Subscription,
        subscription: stripeSubId,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);

      const updatedCustomer = await prisma.customer.findUnique({
        where: {
          id: customer.id,
        },
      });

      expect(updatedCustomer?.stripeCusId).toBe(stripeCusId);
    });

    it('Активируется успешно подписка и создастся outbox_event', async () => {
      const sessionId = 'cs_happy';
      const stripeSubId = 'sub_happy';

      const periodStart = new Date('2026-01-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-01T00:00:00.000Z');

      const eventCreated = 1_726_531_200;

      const { customer, subscription } = await seedPendingCheckout(sessionId, 9001);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: periodStart,
          end: periodEnd,
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: stripeSubId,
          object: 'subscription',
          customer: 'cus_happy',
        } as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        mode: StripeCSModes.Subscription,
        subscription: stripeSubId,
        created: eventCreated,
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({
        where: {
          subscriptionId: subscription.id,
        },
      });

      expect(payment?.status).toBe(PaymentStatus.PAID);

      const updatedSub = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(updatedSub?.status).toBe(SubscriptionStatus.ACTIVE);

      expect(updatedSub?.stripeSubId).toBe(stripeSubId);

      expect(updatedSub?.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());

      expect(updatedSub?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());

      expect(updatedSub?.lastStripeEventAt?.toISOString()).toBe(
        new Date(eventCreated * 1000).toISOString(),
      );

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_ACTIVATED,
        },
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

  describe('Subscription extension', () => {
    it('Продлит подписку и создаст аутбокс команды и ивенты', async () => {
      const sessionId = 'cs_extend';
      const stripeSubId = 'sub_extend';

      const currentPeriodEnd = new Date('2026-01-01T00:00:00.000Z');

      const { subscription } = await seedPendingCheckout(sessionId, 777);

      await prisma.subscription.update({
        where: {
          id: subscription.id,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
        },
      });

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: new Date('2025-12-01T00:00:00.000Z'),
          end: currentPeriodEnd,
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: stripeSubId,
          object: 'subscription',
          customer: 'cus_extend',
        } as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        mode: StripeCSModes.Payment,
        subscription: stripeSubId,
        metadata: {
          subscriptionDuration: '30',
        },
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);

      const payment = await prisma.payment.findFirst({
        where: {
          subscriptionId: subscription.id,
        },
      });

      expect(payment?.status).toBe(PaymentStatus.PAID);

      const updatedSub = await prisma.subscription.findUnique({
        where: {
          id: subscription.id,
        },
      });

      expect(updatedSub?.currentPeriodEnd?.toISOString()).toBe(
        new Date('2026-01-31T00:00:00.000Z').toISOString(),
      );

      const renewedEvent = await prisma.outboxEvent.findFirst({
        where: {
          type: OutboxEventType.SUBSCRIPTION_RENEWED,
        },
      });

      expect(renewedEvent).toBeDefined();

      expect(renewedEvent?.payload).toEqual(
        expect.objectContaining({
          subscriptionId: subscription.id,
        }),
      );

      const command = await prisma.outboxCommand.findFirst({
        where: {
          type: OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION,
        },
      });

      expect(command).toBeDefined();

      expect(command?.payload).toEqual(
        expect.objectContaining({
          stripeSubscriptionId: stripeSubId,
          newEndIso: new Date('2026-01-31T00:00:00.000Z').toISOString(),
        }),
      );
    });

    it('Вернет ok для неподдерживаемого checkout session mode', async () => {
      const sessionId = 'cs_setup';

      await seedPendingCheckout(sessionId, 123);

      retrieveSubscriptionBillingPeriodMock.mockResolvedValue(
        Notification.ok({
          start: new Date(),
          end: new Date(),
        }),
      );

      getSubscriptionMock.mockResolvedValue(
        Notification.ok({
          id: 'sub_setup',
          object: 'subscription',
          customer: 'cus_setup',
        } as Stripe.Subscription),
      );

      const event = makeCheckoutCompletedEvent({
        sessionId,
        mode: 'setup',
      });

      const result = await executeInTx(event);

      expect(result.hasErrors).toBe(false);
    });
  });
});
