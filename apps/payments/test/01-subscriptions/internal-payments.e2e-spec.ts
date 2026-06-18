import { HttpStatus } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@generated/prisma-payments';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { PrismaService } from '../../src/modules/database/prisma.service';
import { Label } from '../../src/setup/configuration/business-rules-settings';
import configuration from '../../src/setup/configuration/configuration';
import { AppTestManager } from '../managers/app.test-manager';
import {
  INTERNAL_API_SECRET_HEADER,
  INTERNAL_PAYMENTS_API_PATH,
  InternalPaymentsPaginatedResponse,
  internalPaymentsQueryDefaults,
  InternalPaymentsSortDirection,
  InternalPaymentsSortField,
} from '../../../../libs/contracts/payments';

describe('InternalPaymentsController - getAllPayments() (GET: /internal/payments)', () => {
  let appTestManager: AppTestManager;
  let server: Server;
  let prisma: PrismaService;

  const INTERNAL_API_SECRET: string = configuration().apiSettings.internalApiSecret;

  async function createSubscriptionWithPayment(params: {
    userId: number;
    planId?: string;
    provider?: PaymentProvider;
    amount?: number;
    paymentCreatedAt?: Date;
  }) {
    const {
      userId,
      planId = 'business_monthly',
      provider = PaymentProvider.STRIPE,
      amount = 1000,
      paymentCreatedAt,
    } = params;

    const customer = await prisma.customer.create({
      data: { userId },
    });

    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId,
        status: SubscriptionStatus.ACTIVE,
        payments: {
          create: {
            planId,
            provider,
            amount,
            status: PaymentStatus.PAID,
            externalId: `ext_${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ...(paymentCreatedAt !== undefined ? { createdAt: paymentCreatedAt } : {}),
          },
        },
      },
      include: { payments: true },
    });

    return { customer, ...subscription };
  }

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    prisma = appTestManager.prisma;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть 401 без internal API secret', async () => {
    await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 401 при невалидном internal API secret', async () => {
    await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .set(INTERNAL_API_SECRET_HEADER, 'invalid-secret')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть пустой список с дефолтной пагинацией', async () => {
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    expect(res.body).toEqual<InternalPaymentsPaginatedResponse>({
      items: [],
      totalCount: 0,
      pagesCount: 0,
      page: internalPaymentsQueryDefaults.page,
      pageSize: internalPaymentsQueryDefaults.pageSize,
    });
  });

  it('должен вернуть платежи с корректной структурой InternalPaymentItem', async () => {
    const currentPeriodEnd = new Date('2026-05-01T00:00:00.000Z');
    const customer = await prisma.customer.create({ data: { userId: 1 } });
    const subscription = await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId: 'business_monthly',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd,
        payments: {
          create: {
            planId: 'business_monthly',
            provider: PaymentProvider.STRIPE,
            amount: 1000,
            status: PaymentStatus.PAID,
            externalId: 'ext_internal_payment_1',
          },
        },
      },
      include: { payments: true },
    });
    const createdPayment = subscription.payments[0];

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual({
      userId: '1',
      subscriptionId: subscription.id.toString(),
      dateOfPayment: createdPayment.createdAt.toISOString(),
      endDateOfSubscription: currentPeriodEnd.toISOString(),
      price: 1000,
      subscriptionType: Label.BusinessMonthly,
      provider: PaymentProvider.STRIPE,
    });
  });

  it('должен фильтровать платежи по userIds', async () => {
    await createSubscriptionWithPayment({ userId: 1, amount: 1000 });
    await createSubscriptionWithPayment({ userId: 2, amount: 2000 });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({ userIds: '2' })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.totalCount).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.userId).toBe('2');
    expect(body.items[0]?.price).toBe(2000);
  });

  it('должен пагинировать платежи: page=2, pageSize=5 при 12 платежах', async () => {
    for (let i = 0; i < 12; i++) {
      await createSubscriptionWithPayment({ userId: 1 });
    }

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({ page: 2, pageSize: 5 })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.items).toHaveLength(5);
    expect(body.totalCount).toBe(12);
    expect(body.pagesCount).toBe(3);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(5);
  });

  it('по умолчанию сортирует по date desc (самый свежий платёж первым)', async () => {
    const oldest = new Date('2026-01-01T00:00:00.000Z');
    const middle = new Date('2026-02-01T00:00:00.000Z');
    const newest = new Date('2026-03-01T00:00:00.000Z');

    await createSubscriptionWithPayment({ userId: 1, paymentCreatedAt: oldest });
    await createSubscriptionWithPayment({ userId: 1, paymentCreatedAt: middle });
    const latestSubscription = await createSubscriptionWithPayment({
      userId: 1,
      paymentCreatedAt: newest,
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.items).toHaveLength(3);
    expect(body.items[0]?.subscriptionId).toBe(latestSubscription.id.toString());
    expect(body.items[0]?.dateOfPayment).toBe(newest.toISOString());
  });

  it('при sortBy=amount и sortDirection=asc возвращает платежи от меньшей суммы к большей', async () => {
    await createSubscriptionWithPayment({ userId: 1, amount: 3000 });
    await createSubscriptionWithPayment({ userId: 2, amount: 1000 });
    await createSubscriptionWithPayment({ userId: 3, amount: 2000 });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({
        sortBy: InternalPaymentsSortField.Amount,
        sortDirection: InternalPaymentsSortDirection.Ascending,
        pageSize: 10,
      })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.items.map((item) => item.price)).toEqual([1000, 2000, 3000]);
  });

  it('при sortBy=provider и sortDirection=desc сортирует провайдеров по убыванию enum-order', async () => {
    await createSubscriptionWithPayment({ userId: 1, provider: PaymentProvider.STRIPE });
    await createSubscriptionWithPayment({ userId: 2, provider: PaymentProvider.PAYPAL });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({
        sortBy: InternalPaymentsSortField.Provider,
        sortDirection: InternalPaymentsSortDirection.Descending,
        pageSize: 10,
      })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.items.map((item) => item.provider)).toEqual([
      PaymentProvider.PAYPAL,
      PaymentProvider.STRIPE,
    ]);
  });

  it('по умолчанию использует pageSize=6', async () => {
    for (let i = 0; i < 7; i++) {
      await createSubscriptionWithPayment({ userId: 1 });
    }

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.items).toHaveLength(6);
    expect(body.pageSize).toBe(internalPaymentsQueryDefaults.pageSize);
    expect(body.page).toBe(internalPaymentsQueryDefaults.page);
    expect(body.totalCount).toBe(7);
    expect(body.pagesCount).toBe(2);
  });

  it('при sortBy=date и sortDirection=asc возвращает платежи от старых к новым', async () => {
    const oldest = new Date('2026-01-01T00:00:00.000Z');
    const newest = new Date('2026-03-01T00:00:00.000Z');

    const oldestSubscription = await createSubscriptionWithPayment({
      userId: 1,
      paymentCreatedAt: oldest,
    });
    await createSubscriptionWithPayment({ userId: 1, paymentCreatedAt: newest });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({
        sortBy: InternalPaymentsSortField.Date,
        sortDirection: InternalPaymentsSortDirection.Ascending,
        pageSize: 10,
      })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.subscriptionId).toBe(oldestSubscription.id.toString());
    expect(body.items[0]?.dateOfPayment).toBe(oldest.toISOString());
  });

  it('должен фильтровать платежи по нескольким userIds (comma-separated)', async () => {
    await createSubscriptionWithPayment({ userId: 1, amount: 1000 });
    await createSubscriptionWithPayment({ userId: 2, amount: 2000 });
    await createSubscriptionWithPayment({ userId: 3, amount: 3000 });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({ userIds: '1,3', pageSize: 10 })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.totalCount).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item) => item.userId).sort()).toEqual(['1', '3']);
    expect(body.items.map((item) => item.price).sort((a, b) => a - b)).toEqual([1000, 3000]);
  });

  it('должен комбинировать userIds и pagination', async () => {
    for (let i = 0; i < 8; i++) {
      await createSubscriptionWithPayment({ userId: 1, amount: (i + 1) * 100 });
    }
    await createSubscriptionWithPayment({ userId: 2, amount: 9999 });

    const page1Res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({ userIds: '1', page: 1, pageSize: 5 })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const page1 = page1Res.body as InternalPaymentsPaginatedResponse;
    expect(page1.items).toHaveLength(5);
    expect(page1.totalCount).toBe(8);
    expect(page1.pagesCount).toBe(2);
    expect(page1.items.every((item) => item.userId === '1')).toBe(true);

    const page2Res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({ userIds: '1', page: 2, pageSize: 5 })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const page2 = page2Res.body as InternalPaymentsPaginatedResponse;
    expect(page2.items).toHaveLength(3);
    expect(page2.page).toBe(2);
    expect(page2.items.every((item) => item.userId === '1')).toBe(true);
  });

  it('должен комбинировать userIds и сортировку по amount DESC', async () => {
    await createSubscriptionWithPayment({ userId: 1, amount: 1000 });
    await createSubscriptionWithPayment({ userId: 2, amount: 3000 });
    await createSubscriptionWithPayment({ userId: 3, amount: 2000 });
    await createSubscriptionWithPayment({ userId: 4, amount: 5000 });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`)
      .query({
        userIds: '1,2,3',
        sortBy: InternalPaymentsSortField.Amount,
        sortDirection: InternalPaymentsSortDirection.Descending,
        pageSize: 10,
      })
      .set(INTERNAL_API_SECRET_HEADER, INTERNAL_API_SECRET)
      .expect(HttpStatus.OK);

    const body = res.body as InternalPaymentsPaginatedResponse;
    expect(body.totalCount).toBe(3);
    expect(body.items.map((item) => item.price)).toEqual([3000, 2000, 1000]);
    expect(body.items.every((item) => ['1', '2', '3'].includes(item.userId))).toBe(true);
  });
});
