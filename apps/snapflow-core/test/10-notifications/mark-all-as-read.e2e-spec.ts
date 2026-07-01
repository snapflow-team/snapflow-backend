import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { Server } from 'http';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { NotificationType } from '@generated/prisma-snapflow';

describe('POST /notifications/mark-all-read (e2e)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;

  let accessToken: string;
  let userId: number;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    authTestManager = new AuthTestManager(appTestManager.prisma, server);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  const seedNotification = async (overrides?: Partial<any>) => {
    return appTestManager.prisma.notification.create({
      data: {
        userId,
        message: 'Test notification',
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
        payload: {},
        isRead: false,
        ...overrides,
      },
    });
  };
  it('должен отметить все уведомления как прочитанные', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    await seedNotification({ isRead: false });
    await seedNotification({ isRead: false });
    await seedNotification({ isRead: false });

    await request(server)
      .post(`/${GLOBAL_PREFIX}/notifications/mark-all-read`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);

    const unreadCount = await appTestManager.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    expect(unreadCount).toBe(0);
  });
  it('должен корректно работать если уведомлений нет', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    const res = await request(server)
      .post(`/${GLOBAL_PREFIX}/notifications/mark-all-read`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);

    expect(res.body).toEqual({});
  });
  it('не должен менять уведомления других пользователей', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    const otherUser = await appTestManager.prisma.user.create({
      data: {
        username: 'other',
        email: 'other@mail.com',
        password: 'hash',
      },
    });

    await appTestManager.prisma.notification.create({
      data: {
        userId: otherUser.id,
        message: 'foreign',
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
        payload: {},
        isRead: false,
      },
    });

    await seedNotification({ isRead: false });
    await seedNotification({ isRead: false });

    await request(server)
      .post(`/${GLOBAL_PREFIX}/notifications/mark-all-read`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);

    const otherUnread = await appTestManager.prisma.notification.count({
      where: {
        userId: otherUser.id,
        isRead: false,
      },
    });

    const myUnread = await appTestManager.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    expect(otherUnread).toBe(1);
    expect(myUnread).toBe(0);
  });
});
