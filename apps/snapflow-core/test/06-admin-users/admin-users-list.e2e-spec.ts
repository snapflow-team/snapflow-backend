import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import { Response } from 'supertest';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

const ADMIN_USERS_QUERY = `
  query AdminUsers($input: AdminUsersQueryInput) {
    adminUsers(input: $input) {
      items {
        id
        username
        createdAt
        profileLink
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

describe('AdminUsersResolver - adminUsers() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let server: Server;
  let sessionCookie: string;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    const adminSettings = configService.get<AdminSettings>('adminSettings');

    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);
    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();
    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть пагинированный список пользователей (pageSize=8 по умолчанию)', async () => {
    for (let i = 0; i < 10; i++) {
      await adminUsersTestManager.createUser({ username: `paginated_user_${i}` });
    }

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { page: 1 } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.adminUsers.items).toHaveLength(8);
    expect(res.body.data.adminUsers.pageInfo).toEqual({
      page: 1,
      pageSize: 8,
      totalCount: 10,
      pagesCount: 2,
    });
  });

  it('должен фильтровать пользователей по search (username contains, case-insensitive)', async () => {
    await adminUsersTestManager.createUser({ username: 'alice_admin' });
    await adminUsersTestManager.createUser({ username: 'bob_admin' });
    await adminUsersTestManager.createUser({ username: 'ALICE_other' });

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { search: 'ali' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.adminUsers.items).toHaveLength(2);
    expect(res.body.data.adminUsers.pageInfo.totalCount).toBe(2);
    expect(
      res.body.data.adminUsers.items.every((item: { username: string }) =>
        item.username.toLowerCase().includes('ali'),
      ),
    ).toBe(true);
  });

  it('должен сортировать пользователей по username ASC', async () => {
    await adminUsersTestManager.createUser({ username: 'zebra_user' });
    await adminUsersTestManager.createUser({ username: 'alpha_user' });
    await adminUsersTestManager.createUser({ username: 'middle_user' });

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { sortBy: 'Username', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(
      res.body.data.adminUsers.items.map((item: { username: string }) => item.username),
    ).toEqual(['alpha_user', 'middle_user', 'zebra_user']);
  });

  it('должен сортировать пользователей по createdAt (явные параметры, не только дефолт)', async () => {
    const older = await adminUsersTestManager.createUser({
      username: 'older_user',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    const newer = await adminUsersTestManager.createUser({
      username: 'newer_user',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const resDesc: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { sortBy: 'CreatedAt', sortDirection: 'Descending' } },
      sessionCookie,
    );

    expect(resDesc.status).toBe(HttpStatus.OK);
    expect(resDesc.body.errors).toBeUndefined();
    expect(resDesc.body.data.adminUsers.items[0].id).toBe(newer.id);
    expect(resDesc.body.data.adminUsers.items[1].id).toBe(older.id);

    const resAsc: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { sortBy: 'CreatedAt', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(resAsc.status).toBe(HttpStatus.OK);
    expect(resAsc.body.errors).toBeUndefined();
    expect(resAsc.body.data.adminUsers.items[0].id).toBe(older.id);
    expect(resAsc.body.data.adminUsers.items[1].id).toBe(newer.id);
  });

  it('должен фильтровать пользователей по banStatusFilter (Blocked/NotBlocked/NotSelected)', async () => {
    const blockedUser = await adminUsersTestManager.createUser({ username: 'blocked_user' });
    const notBlockedUser = await adminUsersTestManager.createUser({ username: 'not_blocked_user' });

    await appTestManager.prisma.user.update({
      where: { id: blockedUser.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const blockedRes: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { banStatusFilter: 'Blocked', sortBy: 'Username', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(blockedRes.status).toBe(HttpStatus.OK);
    expect(blockedRes.body.errors).toBeUndefined();
    expect(blockedRes.body.data.adminUsers.items).toHaveLength(1);
    expect(blockedRes.body.data.adminUsers.items[0].username).toBe('blocked_user');

    const notBlockedRes: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { banStatusFilter: 'NotBlocked', sortBy: 'Username', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(notBlockedRes.status).toBe(HttpStatus.OK);
    expect(notBlockedRes.body.errors).toBeUndefined();
    expect(notBlockedRes.body.data.adminUsers.items).toHaveLength(1);
    expect(notBlockedRes.body.data.adminUsers.items[0].username).toBe(notBlockedUser.username);

    const allRes: Response = await adminUsersTestManager.gql(
      ADMIN_USERS_QUERY,
      { input: { banStatusFilter: 'NotSelected', sortBy: 'Username', sortDirection: 'Ascending' } },
      sessionCookie,
    );

    expect(allRes.status).toBe(HttpStatus.OK);
    expect(allRes.body.errors).toBeUndefined();
    expect(allRes.body.data.adminUsers.pageInfo.totalCount).toBe(2);
  });
});
