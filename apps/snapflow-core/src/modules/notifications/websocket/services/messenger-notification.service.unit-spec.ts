import { Test, TestingModule } from '@nestjs/testing';
import { Notification, NotificationType, User } from '@generated/prisma-snapflow';
import {
  MessengerNotificationsRoutingKey,
  NewMessageNotificationEvent,
} from '../../../../../../../libs/contracts/messenger';
import { UsersRepository } from '../../../user-accounts/users/infrastructure/users.repository';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ConsumedEventsRepository } from '../../infrastructure/consumed-events.repository';
import { NotificationsRepository } from '../../infrastructure/notifications.repository';
import { WebPushSenderService } from '../../push/services/web-push-sender.service';
import { MessengerNotificationService } from './messenger-notification.service';
import { WebsocketService } from './websocket.service';

describe('MessengerNotificationService (unit)', () => {
  let service: MessengerNotificationService;
  let consumedEventsRepositoryMock: { tryConsume: jest.Mock };
  let usersRepositoryMock: { findUserById: jest.Mock };
  let notificationsRepositoryMock: { create: jest.Mock };
  let webSocketServiceMock: { sendToUser: jest.Mock };
  let webPushSenderServiceMock: { sendToUser: jest.Mock };
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };

  const payload: NewMessageNotificationEvent = {
    eventId: '11111111-2222-3333-4444-555555555555',
    chatId: '10',
    lastMessageId: '100',
    senderId: 1,
    recipientId: 2,
    preview: 'Привет!',
    missedCount: 1,
    unreadTotal: 5,
    sentAt: '2026-08-22T12:00:00.000Z',
  };

  const createdNotification: Notification = {
    id: 7,
    userId: 2,
    message: 'Привет!',
    type: NotificationType.NEW_MESSAGE,
    payload: JSON.stringify(payload),
    isRead: false,
    createdAt: new Date('2026-08-22T12:00:01.000Z'),
    updatedAt: new Date('2026-08-22T12:00:01.000Z'),
    deletedAt: null,
  };

  const sender: Pick<User, 'id' | 'username'> = {
    id: 1,
    username: 'alice',
  };

  beforeEach(async () => {
    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    consumedEventsRepositoryMock = {
      tryConsume: jest.fn().mockResolvedValue(true),
    };
    usersRepositoryMock = {
      findUserById: jest.fn().mockResolvedValue(sender),
    };
    notificationsRepositoryMock = {
      create: jest.fn().mockResolvedValue(createdNotification),
    };
    webSocketServiceMock = {
      sendToUser: jest.fn(),
    };
    webPushSenderServiceMock = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessengerNotificationService,
        { provide: ConsumedEventsRepository, useValue: consumedEventsRepositoryMock },
        { provide: UsersRepository, useValue: usersRepositoryMock },
        { provide: NotificationsRepository, useValue: notificationsRepositoryMock },
        { provide: WebsocketService, useValue: webSocketServiceMock },
        { provide: WebPushSenderService, useValue: webPushSenderServiceMock },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get(MessengerNotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен сохранить in-app уведомление, отправить WS и Web Push', async () => {
    await service.applyRoutingKey(MessengerNotificationsRoutingKey.NewMessage, payload);

    expect(consumedEventsRepositoryMock.tryConsume).toHaveBeenCalledWith(
      payload.eventId,
      'messenger',
    );
    expect(usersRepositoryMock.findUserById).toHaveBeenCalledWith(1);
    expect(notificationsRepositoryMock.create).toHaveBeenCalledWith({
      userId: 2,
      message: 'Привет!',
      payload: JSON.stringify(payload),
      type: NotificationType.NEW_MESSAGE,
    });
    expect(webSocketServiceMock.sendToUser).toHaveBeenCalledWith(2, {
      type: NotificationType.NEW_MESSAGE,
      message: 'Привет!',
      createdAt: createdNotification.createdAt.toISOString(),
    });
    expect(webPushSenderServiceMock.sendToUser).toHaveBeenCalledWith(2, {
      title: 'Новое сообщение от alice',
      body: 'Привет!',
      tag: 'messenger-chat-10',
      data: {
        chatId: '10',
        url: '/messenger/10',
        unreadTotal: 5,
      },
    });
  });

  it('при повторной доставке того же eventId не создаёт второе уведомление', async () => {
    consumedEventsRepositoryMock.tryConsume.mockResolvedValue(false);

    await service.applyRoutingKey(MessengerNotificationsRoutingKey.NewMessage, payload);

    expect(consumedEventsRepositoryMock.tryConsume).toHaveBeenCalledWith(
      payload.eventId,
      'messenger',
    );
    expect(usersRepositoryMock.findUserById).not.toHaveBeenCalled();
    expect(notificationsRepositoryMock.create).not.toHaveBeenCalled();
    expect(webSocketServiceMock.sendToUser).not.toHaveBeenCalled();
    expect(webPushSenderServiceMock.sendToUser).not.toHaveBeenCalled();
    expect(loggerMock.log).toHaveBeenCalledWith(
      `Duplicate messenger event ${payload.eventId}, skipping`,
      'handleNewMessageNotification',
    );
  });

  it('для пачки сообщений формирует агрегированный текст', async () => {
    await service.applyRoutingKey(MessengerNotificationsRoutingKey.NewMessage, {
      ...payload,
      missedCount: 10,
    });

    expect(notificationsRepositoryMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '10 новых сообщений от alice',
      }),
    );
  });

  it('подставляет fallback-имя, если отправитель не найден', async () => {
    usersRepositoryMock.findUserById.mockResolvedValue(null);

    await service.applyRoutingKey(MessengerNotificationsRoutingKey.NewMessage, payload);

    expect(webPushSenderServiceMock.sendToUser).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        title: 'Новое сообщение от Пользователь',
      }),
    );
  });

  it('не вызывает tryConsume при невалидном payload', async () => {
    await service.applyRoutingKey(MessengerNotificationsRoutingKey.NewMessage, {
      chatId: '10',
    });

    expect(consumedEventsRepositoryMock.tryConsume).not.toHaveBeenCalled();
    expect(notificationsRepositoryMock.create).not.toHaveBeenCalled();
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it('не бросает ошибку, если доставка WS/push упала после consume', async () => {
    notificationsRepositoryMock.create.mockRejectedValue(new Error('DB error'));

    await expect(
      service.applyRoutingKey(MessengerNotificationsRoutingKey.NewMessage, payload),
    ).resolves.toBeUndefined();

    expect(consumedEventsRepositoryMock.tryConsume).toHaveBeenCalled();
    expect(webSocketServiceMock.sendToUser).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
