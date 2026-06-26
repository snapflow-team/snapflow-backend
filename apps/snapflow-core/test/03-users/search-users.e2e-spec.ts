import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

describe('UsersController - searchUsers() (GET: /users/search)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    const adminSettings = configService.get<AdminSettings>('adminSettings');
    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  function searchUsers(
    accessToken: string | undefined,
    query: { username: string; cursor?: string; limit?: number },
  ) {
    const req = request(server)
      .get(`/${GLOBAL_PREFIX}/users/search`)
      .query(query);

    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }

    return req;
  }

  it('должен вернуть пустой результат, если совпадений по username нет', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await searchUsers(accessToken, { username: 'no_match_prefix' }).expect(
      HttpStatus.OK,
    );

    expect(res.body).toEqual({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('должен вернуть следующую страницу по nextCursor без дубликатов', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    for (let i = 0; i < 10; i++) {
      await adminUsersTestManager.createUser({
        username: `search_paginated_${i}`,
        createdAt: new Date(Date.UTC(2024, 0, 1 + i)),
      });
    }

    const page1: Response = await searchUsers(accessToken, {
      username: 'search_paginated',
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page1.body.items).toHaveLength(8);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2: Response = await searchUsers(accessToken, {
      username: 'search_paginated',
      cursor: page1.body.nextCursor,
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.nextCursor).toBeNull();

    const page1Ids = page1.body.items.map((item: { userId: string }) => item.userId);
    const page2Ids = page2.body.items.map((item: { userId: string }) => item.userId);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it('должен находить пользователей по username без учёта регистра (case-insensitive)', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    await adminUsersTestManager.createUser({ username: 'alice_search' });
    await adminUsersTestManager.createUser({ username: 'bob_search' });
    await adminUsersTestManager.createUser({ username: 'ALICE_other' });

    const res: Response = await searchUsers(accessToken, { username: 'ali' }).expect(HttpStatus.OK);

    expect(res.body.items).toHaveLength(2);
    expect(
      res.body.items.every((item: { username: string }) =>
        item.username.toLowerCase().includes('ali'),
      ),
    ).toBe(true);
  });

  it('не должен возвращать soft-deleted пользователей', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const activeUser = await adminUsersTestManager.createUser({ username: 'search_active_user' });
    await adminUsersTestManager.createUser({
      username: 'search_deleted_user',
      deletedAt: new Date(),
    });

    const res: Response = await searchUsers(accessToken, { username: 'search_' }).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].userId).toBe(activeUser.id.toString());
    expect(res.body.items[0].username).toBe('search_active_user');
  });

  it('не должен возвращать забаненных пользователей', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const activeUser = await adminUsersTestManager.createUser({ username: 'search_not_banned' });
    const bannedUser = await adminUsersTestManager.createUser({ username: 'search_banned' });

    await appTestManager.prisma.user.update({
      where: { id: bannedUser.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const res: Response = await searchUsers(accessToken, { username: 'search_' }).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].userId).toBe(activeUser.id.toString());
    expect(res.body.items[0].username).toBe('search_not_banned');
  });

  it('должен вернуть элементы с полями userId, username, avatarUrl и profileId', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const avatarUrl = 'https://cdn.snapflow.cc/avatars/search-test.jpg';
    const user = await adminUsersTestManager.createUser({
      username: 'search_with_avatar',
      avatarUrl,
    });

    const res: Response = await searchUsers(accessToken, { username: 'search_with_avatar' }).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual({
      userId: user.id.toString(),
      username: 'search_with_avatar',
      avatarUrl,
      profileId: user.profile!.id,
    });
  });

  it('должен вернуть 401 UNAUTHORIZED при вызове без JWT', async () => {
    await searchUsers(undefined, { username: 'any' }).expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 400 BAD_REQUEST при невалидном cursor', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await searchUsers(accessToken, {
      username: 'any',
      cursor: 'not-a-valid-cursor',
    }).expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/search?username=any&cursor=not-a-valid-cursor`,
      method: 'GET',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [{ field: 'cursor', message: 'Invalid cursor' }],
    });
  });
});
