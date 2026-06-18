import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import { Response } from 'supertest';
import {
  GetInternalPaymentsQueryParams,
  InternalPaymentItem,
  InternalPaymentsPaginatedResponse,
  InternalPaymentsSortDirection,
  InternalPaymentsSortField,
} from '../../../../libs/contracts/payments/constants/internal-payments-api.contract';
import { AdminPaymentsHttpClient } from '../../src/modules/admin/infrastructure/clients/admin-payments-http.client';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

const ADMIN_PAYMENTS_QUERY = `
  query AdminPayments($input: AdminPaymentsQueryInput) {
    adminPayments(input: $input) {
      items {
        userId
        username
        avatarUrl
        date
        amount
        subscriptionType
        provider
      }
      pageInfo {
        page
        pageSize
        totalCount
        pagesCount
      }
    }
  }
`;

type MockPayment = {
  userId: number;
  date: string;
  amount: number;
  subscriptionType: string;
  provider: string;
};

const toInternalPaymentItem = (payment: MockPayment, index: number): InternalPaymentItem => ({
  userId: String(payment.userId),
  subscriptionId: `sub-${payment.userId}-${index}`,
  dateOfPayment: payment.date,
  endDateOfSubscription: null,
  price: payment.amount,
  subscriptionType: payment.subscriptionType,
  provider: payment.provider,
});

const buildPaginatedResponse = (
  payments: MockPayment[],
  params: GetInternalPaymentsQueryParams,
): InternalPaymentsPaginatedResponse => {
  let items = payments.map(toInternalPaymentItem);

  if (params.userIds?.length) {
    const userIdSet = new Set(params.userIds.map(String));
    items = items.filter((item) => userIdSet.has(item.userId));
  }

  const direction = params.sortDirection === InternalPaymentsSortDirection.Ascending ? 1 : -1;
  items = [...items].sort((a, b) => {
    switch (params.sortBy) {
      case InternalPaymentsSortField.Amount:
        return (a.price - b.price) * direction;
      case InternalPaymentsSortField.Provider:
        return a.provider.localeCompare(b.provider, undefined, { sensitivity: 'base' }) * direction;
      case InternalPaymentsSortField.Date:
      default:
        return (
          (new Date(a.dateOfPayment).getTime() - new Date(b.dateOfPayment).getTime()) * direction
        );
    }
  });

  const totalCount = items.length;
  const pagesCount = totalCount === 0 ? 0 : Math.ceil(totalCount / params.pageSize);
  const skip = (params.page - 1) * params.pageSize;

  return {
    page: params.page,
    pageSize: params.pageSize,
    totalCount,
    pagesCount,
    items: items.slice(skip, skip + params.pageSize),
  };
};

describe('AdminPaymentsResolver - adminPayments() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let server: Server;
  let sessionCookie: string;
  let getPaymentsMock: jest.Mock;
  let mockPayments: MockPayment[];

  beforeAll(async () => {
    mockPayments = [];
    getPaymentsMock = jest
      .fn()
      .mockImplementation((params: GetInternalPaymentsQueryParams) =>
        Promise.resolve(buildPaginatedResponse(mockPayments, params)),
      );

    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(AdminPaymentsHttpClient).useValue({
        getPayments: getPaymentsMock,
      }),
    );

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    const adminSettings = configService.get<AdminSettings>('adminSettings');

    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);
    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();
    mockPayments = [];
    getPaymentsMock.mockClear();
    getPaymentsMock.mockImplementation((params: GetInternalPaymentsQueryParams) =>
      Promise.resolve(buildPaginatedResponse(mockPayments, params)),
    );
    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  const setMockPayments = (payments: MockPayment[]) => {
    mockPayments = payments;
  };

  it('должен джойнить username и avatarUrl из БД', async () => {
    const userWithAvatar = await adminUsersTestManager.createUser({
      username: 'payments_alice',
      avatarUrl: 'https://cdn.example.com/alice.png',
    });
    const userWithoutAvatar = await adminUsersTestManager.createUser({
      username: 'payments_bob',
    });

    setMockPayments([
      {
        userId: userWithAvatar.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: userWithoutAvatar.id,
        date: '2026-05-01T12:00:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(ADMIN_PAYMENTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledTimes(1);
    expect(res.body.data.adminPayments.items).toEqual(
      expect.arrayContaining([
        {
          userId: userWithAvatar.id,
          username: 'payments_alice',
          avatarUrl: 'https://cdn.example.com/alice.png',
          date: '2026-04-21T10:30:00.000Z',
          amount: 1000,
          subscriptionType: 'Business Monthly',
          provider: 'STRIPE',
        },
        {
          userId: userWithoutAvatar.id,
          username: 'payments_bob',
          avatarUrl: null,
          date: '2026-05-01T12:00:00.000Z',
          amount: 2000,
          subscriptionType: 'Pro Yearly',
          provider: 'PAYPAL',
        },
      ]),
    );
    expect(res.body.data.adminPayments.items).toHaveLength(2);
  });

  it('должен отбрасывать платежи удалённых и ненайденных пользователей', async () => {
    const activeUser = await adminUsersTestManager.createUser({ username: 'active_payer' });
    const deletedUser = await adminUsersTestManager.createUser({
      username: 'deleted_payer',
      deletedAt: new Date(),
    });

    setMockPayments([
      {
        userId: activeUser.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: deletedUser.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 500,
        subscriptionType: 'Basic Monthly',
        provider: 'STRIPE',
      },
      {
        userId: 999999,
        date: '2026-04-23T10:30:00.000Z',
        amount: 300,
        subscriptionType: 'Basic Monthly',
        provider: 'PAYPAL',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(ADMIN_PAYMENTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.adminPayments.items).toHaveLength(1);
    expect(res.body.data.adminPayments.items[0].userId).toBe(activeUser.id);
    expect(res.body.data.adminPayments.pageInfo.totalCount).toBe(3);
  });

  it('должен фильтровать платежи по search (username contains, case-insensitive)', async () => {
    const alice = await adminUsersTestManager.createUser({ username: 'alice_payments' });
    const bob = await adminUsersTestManager.createUser({ username: 'bob_payments' });
    const aliceOther = await adminUsersTestManager.createUser({ username: 'ALICE_other' });

    setMockPayments([
      {
        userId: alice.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: bob.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
      {
        userId: aliceOther.id,
        date: '2026-04-23T10:30:00.000Z',
        amount: 1500,
        subscriptionType: 'Basic Monthly',
        provider: 'STRIPE',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'ali' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: expect.arrayContaining([alice.id, aliceOther.id]),
      }),
    );
    expect(res.body.data.adminPayments.items).toHaveLength(2);
    expect(res.body.data.adminPayments.pageInfo.totalCount).toBe(2);
    expect(
      res.body.data.adminPayments.items.every((item: { username: string }) =>
        item.username.toLowerCase().includes('ali'),
      ),
    ).toBe(true);
  });

  it('должен сортировать платежи по username ASC', async () => {
    const zebra = await adminUsersTestManager.createUser({ username: 'zebra_payer' });
    const alpha = await adminUsersTestManager.createUser({ username: 'alpha_payer' });
    const middle = await adminUsersTestManager.createUser({ username: 'middle_payer' });

    setMockPayments([
      {
        userId: zebra.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: alpha.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
      {
        userId: middle.id,
        date: '2026-04-23T10:30:00.000Z',
        amount: 1500,
        subscriptionType: 'Basic Monthly',
        provider: 'STRIPE',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { sortBy: 'Username', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(
      res.body.data.adminPayments.items.map((item: { username: string }) => item.username),
    ).toEqual(['alpha_payer', 'middle_payer', 'zebra_payer']);
  });

  it('должен сортировать платежи по date DESC по умолчанию', async () => {
    const older = await adminUsersTestManager.createUser({ username: 'older_payer' });
    const newer = await adminUsersTestManager.createUser({ username: 'newer_payer' });

    setMockPayments([
      {
        userId: older.id,
        date: '2020-01-01T00:00:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: newer.id,
        date: '2025-01-01T00:00:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(ADMIN_PAYMENTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: InternalPaymentsSortField.Date,
        sortDirection: InternalPaymentsSortDirection.Descending,
      }),
    );
    expect(res.body.data.adminPayments.items[0].userId).toBe(newer.id);
    expect(res.body.data.adminPayments.items[1].userId).toBe(older.id);
  });

  it('должен сортировать платежи по amount ASC', async () => {
    const low = await adminUsersTestManager.createUser({ username: 'low_payer' });
    const high = await adminUsersTestManager.createUser({ username: 'high_payer' });
    const mid = await adminUsersTestManager.createUser({ username: 'mid_payer' });

    setMockPayments([
      {
        userId: high.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 3000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: low.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 500,
        subscriptionType: 'Basic Monthly',
        provider: 'PAYPAL',
      },
      {
        userId: mid.id,
        date: '2026-04-23T10:30:00.000Z',
        amount: 1500,
        subscriptionType: 'Pro Yearly',
        provider: 'STRIPE',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { sortBy: 'Amount', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: InternalPaymentsSortField.Amount,
        sortDirection: InternalPaymentsSortDirection.Ascending,
      }),
    );
    expect(
      res.body.data.adminPayments.items.map((item: { amount: number }) => item.amount),
    ).toEqual([500, 1500, 3000]);
  });

  it('должен сортировать платежи по provider ASC', async () => {
    const stripeUser = await adminUsersTestManager.createUser({ username: 'stripe_payer' });
    const paypalUser = await adminUsersTestManager.createUser({ username: 'paypal_payer' });
    const appleUser = await adminUsersTestManager.createUser({ username: 'apple_payer' });

    setMockPayments([
      {
        userId: stripeUser.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: paypalUser.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
      {
        userId: appleUser.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1500,
        subscriptionType: 'Basic Monthly',
        provider: 'APPLE',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { sortBy: 'Provider', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: InternalPaymentsSortField.Provider,
        sortDirection: InternalPaymentsSortDirection.Ascending,
      }),
    );
    expect(
      res.body.data.adminPayments.items.map((item: { provider: string }) => item.provider),
    ).toEqual(['APPLE', 'PAYPAL', 'STRIPE']);
  });

  it('должен пагинировать платежи (pageSize=6 по умолчанию)', async () => {
    const users: Awaited<ReturnType<AdminUsersTestManager['createUser']>>[] = [];

    for (let i = 0; i < 7; i++) {
      users.push(await adminUsersTestManager.createUser({ username: `paged_payer_${i}` }));
    }

    setMockPayments(
      users.map((user, index) => ({
        userId: user.id,
        date: `2026-04-${String(index + 1).padStart(2, '0')}T10:30:00.000Z`,
        amount: (index + 1) * 100,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      })),
    );

    const page1Res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { page: 1 } },
      sessionCookie,
    );

    expect(page1Res.status).toBe(HttpStatus.OK);
    expect(page1Res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        page: 1,
        pageSize: 6,
      }),
    );
    expect(page1Res.body.data.adminPayments.items).toHaveLength(6);
    expect(page1Res.body.data.adminPayments.pageInfo).toEqual({
      page: 1,
      pageSize: 6,
      totalCount: 7,
      pagesCount: 2,
    });

    const page2Res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { page: 2 } },
      sessionCookie,
    );

    expect(page2Res.status).toBe(HttpStatus.OK);
    expect(page2Res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 2,
        pageSize: 6,
      }),
    );
    expect(page2Res.body.data.adminPayments.items).toHaveLength(1);
    expect(page2Res.body.data.adminPayments.pageInfo).toEqual({
      page: 2,
      pageSize: 6,
      totalCount: 7,
      pagesCount: 2,
    });
  });

  it('должен вернуть пустой список при отсутствии платежей', async () => {
    await adminUsersTestManager.createUser({ username: 'no_payments_user' });

    const res: Response = await adminUsersTestManager.gql(ADMIN_PAYMENTS_QUERY, {}, sessionCookie);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledTimes(1);
    expect(res.body.data.adminPayments.items).toEqual([]);
    expect(res.body.data.adminPayments.pageInfo).toEqual({
      page: 1,
      pageSize: 6,
      totalCount: 0,
      pagesCount: 0,
    });
  });

  it('должен вернуть пустой результат при search без совпадений (без вызова payments API)', async () => {
    await adminUsersTestManager.createUser({ username: 'existing_user' });

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'nonexistent_xyz' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).not.toHaveBeenCalled();
    expect(res.body.data.adminPayments.items).toEqual([]);
    expect(res.body.data.adminPayments.pageInfo).toEqual({
      page: 1,
      pageSize: 6,
      totalCount: 0,
      pagesCount: 0,
    });
  });

  it('должен комбинировать search и pagination', async () => {
    const matchingUsers: Awaited<ReturnType<AdminUsersTestManager['createUser']>>[] = [];

    for (let i = 0; i < 8; i++) {
      matchingUsers.push(
        await adminUsersTestManager.createUser({ username: `search_page_user_${i}` }),
      );
    }
    const nonMatchingUser = await adminUsersTestManager.createUser({ username: 'other_user' });

    setMockPayments([
      ...matchingUsers.map((user, index) => ({
        userId: user.id,
        date: `2026-04-${String(index + 1).padStart(2, '0')}T10:30:00.000Z`,
        amount: (index + 1) * 100,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      })),
      {
        userId: nonMatchingUser.id,
        date: '2026-04-30T10:30:00.000Z',
        amount: 9999,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
    ]);

    const page1Res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'search_page', page: 1 } },
      sessionCookie,
    );

    expect(page1Res.status).toBe(HttpStatus.OK);
    expect(page1Res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userIds: expect.arrayContaining(matchingUsers.map((user) => user.id)),
        page: 1,
        pageSize: 6,
      }),
    );
    expect(page1Res.body.data.adminPayments.items).toHaveLength(6);
    expect(page1Res.body.data.adminPayments.pageInfo).toEqual({
      page: 1,
      pageSize: 6,
      totalCount: 8,
      pagesCount: 2,
    });

    const page2Res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'search_page', page: 2 } },
      sessionCookie,
    );

    expect(page2Res.status).toBe(HttpStatus.OK);
    expect(page2Res.body.errors).toBeUndefined();
    expect(page2Res.body.data.adminPayments.items).toHaveLength(2);
    expect(page2Res.body.data.adminPayments.pageInfo).toEqual({
      page: 2,
      pageSize: 6,
      totalCount: 8,
      pagesCount: 2,
    });
    expect(
      page2Res.body.data.adminPayments.items.every((item: { username: string }) =>
        item.username.includes('search_page'),
      ),
    ).toBe(true);
  });

  it('должен комбинировать search и сортировку по amount DESC', async () => {
    const low = await adminUsersTestManager.createUser({ username: 'search_amt_low' });
    const high = await adminUsersTestManager.createUser({ username: 'search_amt_high' });
    const mid = await adminUsersTestManager.createUser({ username: 'search_amt_mid' });
    const other = await adminUsersTestManager.createUser({ username: 'unrelated_user' });

    setMockPayments([
      {
        userId: low.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 500,
        subscriptionType: 'Basic Monthly',
        provider: 'STRIPE',
      },
      {
        userId: high.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 3000,
        subscriptionType: 'Business Monthly',
        provider: 'PAYPAL',
      },
      {
        userId: mid.id,
        date: '2026-04-23T10:30:00.000Z',
        amount: 1500,
        subscriptionType: 'Pro Yearly',
        provider: 'STRIPE',
      },
      {
        userId: other.id,
        date: '2026-04-24T10:30:00.000Z',
        amount: 9999,
        subscriptionType: 'Basic Monthly',
        provider: 'APPLE',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'search_amt', sortBy: 'Amount', sortDirection: 'Descending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: expect.arrayContaining([low.id, high.id, mid.id]),
        sortBy: InternalPaymentsSortField.Amount,
        sortDirection: InternalPaymentsSortDirection.Descending,
      }),
    );
    expect(
      res.body.data.adminPayments.items.map((item: { amount: number }) => item.amount),
    ).toEqual([3000, 1500, 500]);
    expect(res.body.data.adminPayments.pageInfo.totalCount).toBe(3);
  });

  it('должен комбинировать search, сортировку по username и pagination', async () => {
    const users: Awaited<ReturnType<AdminUsersTestManager['createUser']>>[] = [];

    for (let i = 0; i < 8; i++) {
      users.push(await adminUsersTestManager.createUser({ username: `search_sort_user_${i}` }));
    }

    setMockPayments(
      users.map((user, index) => ({
        userId: user.id,
        date: `2026-04-${String(index + 1).padStart(2, '0')}T10:30:00.000Z`,
        amount: (index + 1) * 100,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      })),
    );

    const page1Res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'search_sort', sortBy: 'Username', sortDirection: 'Ascending', page: 1 } },
      sessionCookie,
    );

    expect(page1Res.status).toBe(HttpStatus.OK);
    expect(page1Res.body.errors).toBeUndefined();
    expect(page1Res.body.data.adminPayments.items).toHaveLength(6);
    expect(
      page1Res.body.data.adminPayments.items.map((item: { username: string }) => item.username),
    ).toEqual([
      'search_sort_user_0',
      'search_sort_user_1',
      'search_sort_user_2',
      'search_sort_user_3',
      'search_sort_user_4',
      'search_sort_user_5',
    ]);

    const page2Res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { search: 'search_sort', sortBy: 'Username', sortDirection: 'Ascending', page: 2 } },
      sessionCookie,
    );

    expect(page2Res.status).toBe(HttpStatus.OK);
    expect(page2Res.body.errors).toBeUndefined();
    expect(page2Res.body.data.adminPayments.items).toHaveLength(2);
    expect(
      page2Res.body.data.adminPayments.items.map((item: { username: string }) => item.username),
    ).toEqual(['search_sort_user_6', 'search_sort_user_7']);
    expect(page2Res.body.data.adminPayments.pageInfo).toEqual({
      page: 2,
      pageSize: 6,
      totalCount: 8,
      pagesCount: 2,
    });
  });

  it('должен сортировать платежи по date ASC (явный параметр)', async () => {
    const older = await adminUsersTestManager.createUser({ username: 'date_asc_older' });
    const newer = await adminUsersTestManager.createUser({ username: 'date_asc_newer' });

    setMockPayments([
      {
        userId: newer.id,
        date: '2025-01-01T00:00:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
      {
        userId: older.id,
        date: '2020-01-01T00:00:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { sortBy: 'Date', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: InternalPaymentsSortField.Date,
        sortDirection: InternalPaymentsSortDirection.Ascending,
      }),
    );
    expect(res.body.data.adminPayments.items[0].userId).toBe(older.id);
    expect(res.body.data.adminPayments.items[1].userId).toBe(newer.id);
  });

  it('должен сортировать платежи по amount DESC (явный параметр)', async () => {
    const low = await adminUsersTestManager.createUser({ username: 'amt_desc_low' });
    const high = await adminUsersTestManager.createUser({ username: 'amt_desc_high' });

    setMockPayments([
      {
        userId: low.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 500,
        subscriptionType: 'Basic Monthly',
        provider: 'STRIPE',
      },
      {
        userId: high.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 3000,
        subscriptionType: 'Business Monthly',
        provider: 'PAYPAL',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { sortBy: 'Amount', sortDirection: 'Descending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(getPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: InternalPaymentsSortField.Amount,
        sortDirection: InternalPaymentsSortDirection.Descending,
      }),
    );
    expect(
      res.body.data.adminPayments.items.map((item: { amount: number }) => item.amount),
    ).toEqual([3000, 500]);
  });

  it('должен сортировать платежи по username DESC (явный параметр)', async () => {
    const alpha = await adminUsersTestManager.createUser({ username: 'alpha_desc' });
    const zebra = await adminUsersTestManager.createUser({ username: 'zebra_desc' });

    setMockPayments([
      {
        userId: alpha.id,
        date: '2026-04-21T10:30:00.000Z',
        amount: 1000,
        subscriptionType: 'Business Monthly',
        provider: 'STRIPE',
      },
      {
        userId: zebra.id,
        date: '2026-04-22T10:30:00.000Z',
        amount: 2000,
        subscriptionType: 'Pro Yearly',
        provider: 'PAYPAL',
      },
    ]);

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_PAYMENTS_QUERY,
      { input: { sortBy: 'Username', sortDirection: 'Descending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(
      res.body.data.adminPayments.items.map((item: { username: string }) => item.username),
    ).toEqual(['zebra_desc', 'alpha_desc']);
  });
});
