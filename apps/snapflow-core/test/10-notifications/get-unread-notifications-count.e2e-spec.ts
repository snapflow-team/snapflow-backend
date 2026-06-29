import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { Server } from 'http';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { NotificationType } from '@generated/prisma-snapflow';

describe('GET /notifications/unread-count (e2e)', () => {
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

  it('должен вернуть количество непрочитанных уведомлений', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    await seedNotification({ isRead: false });
    await seedNotification({ isRead: false });
    await seedNotification({ isRead: true });

    const res = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications/unread-count`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body).toMatchObject({
      count: '2',
    });
  });

  it('должен вернуть 0 если непрочитанных уведомлений нет', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    await seedNotification({ isRead: true });
    await seedNotification({ isRead: true });

    const res = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications/unread-count`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.count).toBe('0');
  });

  it('не должен учитывать уведомления других пользователей', async () => {
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
        message: 'foreign unread',
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
        payload: {},
        isRead: false,
      },
    });

    await seedNotification({ isRead: false });

    const res = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications/unread-count`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.count).toBe('1');
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
});
