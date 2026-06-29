import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { NotificationType } from '@generated/prisma-snapflow';
import { AuthTestManager } from '../managers/auth.test-manager';

describe('Get Notifications (e2e)', () => {
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
  it('должен вернуть список уведомлений пользователя', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    await seedNotification({
      message: 'First notification',
    });

    await seedNotification({
      message: 'Second notification',
    });

    const res = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.items.length).toBeGreaterThan(0);

    for (const item of res.body.items) {
      expect(item).toMatchObject({
        id: expect.any(String),
        message: expect.any(String),
        notificationType: expect.any(String),
        isRead: expect.any(Boolean),
        createdAt: expect.any(String),
      });
    }

    expect(res.body.hasMore).toBeDefined();
    expect(res.body.nextCursor).toBeDefined();
  });
  it('не должен возвращать уведомления другого пользователя', async () => {
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
        message: 'foreign notification',
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
        payload: {},
        isRead: false,
      },
    });

    await seedNotification({
      message: 'own notification',
    });

    const res = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    const messages = res.body.items.map((n: any) => n.message);

    expect(messages).toContain('own notification');
    expect(messages).not.toContain('foreign notification');
  });
  it('должен корректно работать с cursor пагинацией', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    for (let i = 0; i < 10; i++) {
      await seedNotification({
        message: `notification-${i}`,
      });
    }

    const firstPage = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications?limit=5`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(firstPage.body.items.length).toBe(5);
    expect(firstPage.body.nextCursor).toBeDefined();

    const secondPage = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications?limit=5&cursor=${firstPage.body.nextCursor}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(secondPage.body.items.length).toBeGreaterThan(0);

    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });
  it('должен вернуть пустой список если уведомлений нет', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    accessToken = result.accessToken;
    userId = result.createdUser.id;

    const res = await request(server)
      .get(`/${GLOBAL_PREFIX}/notifications`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.items).toEqual([]);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
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
