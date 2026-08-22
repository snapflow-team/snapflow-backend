import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { WebPushSenderService } from './web-push-sender.service';
import { PushSubscriptionsRepository } from '../repositories/push-subscriptions.repository';
import { LoggerFactory } from '../../../logger/logger.factory';
import { PushSubscription } from '@generated/prisma-snapflow';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('WebPushSenderService (Unit)', () => {
  let service: WebPushSenderService;
  let pushSubscriptionsRepositoryMock: Record<keyof PushSubscriptionsRepository, jest.Mock>;
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  const subscription: PushSubscription = {
    id: 1,
    userId: 42,
    endpoint: 'https://push.example/endpoint-1',
    p256dh: 'p256dh-key',
    auth: 'auth-key',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-08-22T09:00:00.000Z'),
    lastUsedAt: null,
  };

  const payload = {
    title: 'Новое сообщение от alice',
    body: 'Привет!',
    tag: 'messenger-chat-7',
    data: {
      chatId: '7',
      url: '/messenger/7',
      unreadTotal: 5,
    },
  };

  beforeEach(async () => {
    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    pushSubscriptionsRepositoryMock = {
      upsertByEndpoint: jest.fn(),
      findByUserId: jest.fn(),
      deleteByEndpoint: jest.fn(),
      deleteByEndpointOnly: jest.fn(),
      touchLastUsedAt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebPushSenderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              vapidSubject: 'mailto:test@example.com',
              vapidPublicKey: 'public-key',
              vapidPrivateKey: 'private-key',
            }),
          },
        },
        { provide: PushSubscriptionsRepository, useValue: pushSubscriptionsRepositoryMock },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get<WebPushSenderService>(WebPushSenderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit()', () => {
    it('должен настроить VAPID-ключи', () => {
      service.onModuleInit();

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        'public-key',
        'private-key',
      );
    });
  });

  describe('sendToUser()', () => {
    it('должен завершиться без действий, если подписок нет', async () => {
      pushSubscriptionsRepositoryMock.findByUserId.mockResolvedValue([]);

      await service.sendToUser(42, payload);

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('должен отправить push и обновить lastUsedAt при успехе', async () => {
      pushSubscriptionsRepositoryMock.findByUserId.mockResolvedValue([subscription]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue(undefined);

      await service.sendToUser(42, payload);

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      expect(pushSubscriptionsRepositoryMock.touchLastUsedAt).toHaveBeenCalledWith(
        subscription.endpoint,
      );
    });

    it('должен удалить подписку при ответе 410', async () => {
      pushSubscriptionsRepositoryMock.findByUserId.mockResolvedValue([subscription]);
      (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 410 });

      await service.sendToUser(42, payload);

      expect(pushSubscriptionsRepositoryMock.deleteByEndpointOnly).toHaveBeenCalledWith(
        subscription.endpoint,
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        `Removed expired push subscription (status 410): ${subscription.endpoint}`,
        'sendToUser',
      );
      expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('должен логировать ошибку без удаления подписки при других статусах', async () => {
      pushSubscriptionsRepositoryMock.findByUserId.mockResolvedValue([subscription]);
      const error = { statusCode: 500, message: 'Internal error' };
      (webpush.sendNotification as jest.Mock).mockRejectedValue(error);

      await service.sendToUser(42, payload);

      expect(pushSubscriptionsRepositoryMock.deleteByEndpointOnly).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith(error, 'sendToUser');
    });
  });
});
