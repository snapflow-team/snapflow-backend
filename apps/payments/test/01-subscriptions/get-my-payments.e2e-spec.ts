import { HttpService } from '@nestjs/axios';
import { HttpStatus } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@generated/prisma-payments';
import { Server } from 'http';
import { of, throwError } from 'rxjs';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { PrismaService } from '../../src/modules/database/prisma.service';
import { AppTestManager } from '../managers/app.test-manager';
import { PaymentViewDto } from '../../src/modules/subscriptions/api/view-dto/payment.view-dto';
import { PaginatedViewDto } from '../../src/common/dto/paginated.view-dto';
import { Label } from '../../src/setup/configuration/business-rules-settings';

describe('SubscriptionsController - getMyPayments() (GET: /subscriptions/my-payments)', () => {
  let appTestManager: AppTestManager;
  let server: Server;
  let prisma: PrismaService;
  const httpGetMock = jest.fn();

  const TEST_USER_ID = 1;

  async function createSubscriptionWithPayment(params: {
    userId: number;
    planId?: string;
    provider?: PaymentProvider;
    amount?: number;
    paymentDeletedAt?: Date | null;
    subscriptionDeletedAt?: Date | null;
    currentPeriodEnd?: Date | null;
  }) {
    const {
      userId,
      planId = 'business_monthly',
      provider = PaymentProvider.STRIPE,
      amount = 1000,
      paymentDeletedAt = null,
      subscriptionDeletedAt = null,
      currentPeriodEnd = null,
    } = params;

    return prisma.subscription.create({
      data: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd,
        deletedAt: subscriptionDeletedAt,
        payments: {
          create: {
            planId,
            provider,
            amount,
            status: PaymentStatus.PAID,
            externalId: `ext_${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            deletedAt: paymentDeletedAt,
          },
        },
      },
      include: { payments: true },
    });
  }

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((builder) => {
      builder.overrideProvider(HttpService).useValue({
        get: httpGetMock,
      });
    });

    server = appTestManager.getServer();
    prisma = appTestManager.prisma;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    httpGetMock.mockReset();
    httpGetMock.mockReturnValue(
      of({
        data: {
          userId: String(TEST_USER_ID),
          email: 'u@test.com',
          username: 'user',
        },
      }),
    );
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть 401 без заголовка Authorization', async () => {
    await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(httpGetMock).not.toHaveBeenCalled();
  });

  it('должен вернуть 401 при невалидном токене', async () => {
    httpGetMock.mockReturnValue(throwError(() => new Error('Unauthorized')));

    await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer invalid-token')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть пустой список платежей с корректной пагинацией, если у пользователя нет платежей', async () => {
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    expect(res.body).toEqual<PaginatedViewDto<PaymentViewDto>>({
      items: [],
      totalCount: 0,
      pagesCount: 0,
      page: 1,
      pageSize: 10,
    });
  });

  it('должен вернуть платеж с полной структурой PaymentViewDto', async () => {
    const currentPeriodEnd = new Date('2026-05-01T00:00:00.000Z');
    const subscriptionWithPayment = await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_monthly',
      provider: PaymentProvider.STRIPE,
      amount: 1000,
      currentPeriodEnd,
    });
    const createdPayment = subscriptionWithPayment.payments[0];

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toEqual<PaymentViewDto>({
      userId: String(TEST_USER_ID),
      subscriptionId: subscriptionWithPayment.id.toString(),
      dateOfPayment: createdPayment.createdAt.toISOString(),
      endDateOfSubscription: currentPeriodEnd.toISOString(),
      price: 1000,
      subscriptionType: Label.BusinessMonthly,
      provider: PaymentProvider.STRIPE,
    });
  });

  it('должен возвращать subscriptionType "Business Monthly" для planId=business_monthly', async () => {
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_monthly',
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.subscriptionType).toBe(Label.BusinessMonthly);
  });

  it('должен возвращать subscriptionType "Business Yearly" для planId=business_yearly', async () => {
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_yearly',
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.subscriptionType).toBe(Label.BusinessYearly);
  });

  it('должен возвращать только платежи текущего пользователя', async () => {
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_monthly',
    });
    await createSubscriptionWithPayment({
      userId: 2,
      planId: 'business_yearly',
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.userId).toBe(String(TEST_USER_ID));
    expect(body.items.some((item) => item.userId === '2')).toBe(false);
  });

  it('должен возвращать только платежи со статусом PAID', async () => {
    const paidSubscription = await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_monthly',
    });

    await prisma.payment.create({
      data: {
        subscriptionId: paidSubscription.id,
        planId: 'business_monthly',
        provider: PaymentProvider.STRIPE,
        amount: 1500,
        status: PaymentStatus.PENDING,
        externalId: `ext_pending_${TEST_USER_ID}_${Date.now()}`,
      },
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.totalCount).toBe(1);
    expect(body.items[0]?.price).toBe(1000);
  });

  // vilyamz: тест заработает после удаления partial index на userId
  it.skip('не должен возвращать платежи с payment.deletedAt != null', async () => {
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_monthly',
    });
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_yearly',
      paymentDeletedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.totalCount).toBe(1);
    expect(body.items[0]?.subscriptionType).toBe(Label.BusinessMonthly);
  });

  // vilyamz: тест заработает после удаления partial index на userId
  it.skip('не должен возвращать платежи подписок с subscription.deletedAt != null', async () => {
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_monthly',
    });
    await createSubscriptionWithPayment({
      userId: TEST_USER_ID,
      planId: 'business_yearly',
      subscriptionDeletedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/my-payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(HttpStatus.OK);

    const body = res.body as PaginatedViewDto<PaymentViewDto>;
    expect(body.items).toHaveLength(1);
    expect(body.totalCount).toBe(1);
    expect(body.items[0]?.subscriptionType).toBe(Label.BusinessMonthly);
  });

  // vilyamz: написать тесты на пагинацию и сортировку после удаления partial index на userId
});
