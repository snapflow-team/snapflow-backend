import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Message,
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
} from '@generated/prisma-messenger';
import {
  MESSENGER_EXCHANGE,
  MessengerNotificationsRoutingKey,
} from '../../../../../../../libs/contracts/messenger';
import { LoggerFactory } from '../../../logger/logger.factory';
import { OutboxProcessing } from '../../../outbox/constants/outbox.constants';
import { OutboxRepository } from '../../../outbox/repositories/outbox.repository';
import { RabbitMQPublisherService } from '../../../rabbitmq/rabbitmq-publisher.service';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { NewMessageNotificationDispatcherService } from './new-message-notification-dispatcher.service';
import { NewMessageNotificationPolicy } from './new-message-notification.policy';

jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomUUID: jest.fn(() => '11111111-2222-3333-4444-555555555555'),
  };
});

function createOutboxEvent(
  overrides: Partial<OutboxEvent> & {
    payload: {
      chatId: number;
      messageId: number;
      senderId: number;
      recipientId: number;
    };
  },
): OutboxEvent {
  return {
    id: 'event-1',
    type: OutboxEventType.NEW_MESSAGE_NOTIFICATION,
    status: OutboxEventStatus.PROCESSING,
    availableAt: new Date(),
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('NewMessageNotificationDispatcherService (unit)', () => {
  let service: NewMessageNotificationDispatcherService;
  let outboxRepositoryMock: {
    lockEventsForProcessing: jest.Mock;
    markAsProcessed: jest.Mock;
    markAsSkipped: jest.Mock;
    releaseToPending: jest.Mock;
  };
  let policyMock: { shouldNotify: jest.Mock };
  let chatsQueryRepositoryMock: { getTotalUnreadCount: jest.Mock };
  let rabbitPublisherMock: { publish: jest.Mock };
  let loggerMock: { debug: jest.Mock; error: jest.Mock };

  const message: Message = {
    id: 103,
    chatId: 10,
    senderId: 1,
    text: 'a'.repeat(150),
    clientMessageId: '11111111-1111-1111-1111-111111111111',
    createdAt: new Date('2026-08-02T12:00:00.000Z'),
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    loggerMock = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    outboxRepositoryMock = {
      lockEventsForProcessing: jest.fn().mockResolvedValue([]),
      markAsProcessed: jest.fn().mockResolvedValue(undefined),
      markAsSkipped: jest.fn().mockResolvedValue(undefined),
      releaseToPending: jest.fn().mockResolvedValue(undefined),
    };
    policyMock = {
      shouldNotify: jest.fn().mockResolvedValue({ shouldNotify: true, message }),
    };
    chatsQueryRepositoryMock = {
      getTotalUnreadCount: jest.fn().mockResolvedValue(7),
    };
    rabbitPublisherMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewMessageNotificationDispatcherService,
        { provide: OutboxRepository, useValue: outboxRepositoryMock },
        { provide: NewMessageNotificationPolicy, useValue: policyMock },
        { provide: ChatsQueryRepository, useValue: chatsQueryRepositoryMock },
        { provide: RabbitMQPublisherService, useValue: rabbitPublisherMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              pushPreviewMaxLength: 120,
            } satisfies Pick<BusinessRulesSettings, 'pushPreviewMaxLength'>),
          },
        },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get(NewMessageNotificationDispatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('не вызывает policy/publish, если батч пуст', async () => {
    await service.dispatchPendingNotifications();

    expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledWith(
      OutboxEventType.NEW_MESSAGE_NOTIFICATION,
      OutboxProcessing.LOCK_BATCH_SIZE,
    );
    expect(policyMock.shouldNotify).not.toHaveBeenCalled();
    expect(rabbitPublisherMock.publish).not.toHaveBeenCalled();
  });

  it('группирует события по (recipientId, chatId), считает missedCount и публикует один пуш', async () => {
    const events = [
      createOutboxEvent({
        id: 'e1',
        payload: { chatId: 10, messageId: 101, senderId: 1, recipientId: 2 },
      }),
      createOutboxEvent({
        id: 'e2',
        payload: { chatId: 10, messageId: 103, senderId: 1, recipientId: 2 },
      }),
      createOutboxEvent({
        id: 'e3',
        payload: { chatId: 10, messageId: 102, senderId: 1, recipientId: 2 },
      }),
      createOutboxEvent({
        id: 'e4',
        payload: { chatId: 11, messageId: 200, senderId: 1, recipientId: 2 },
      }),
    ];
    outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue(events);

    const secondMessage: Message = { ...message, id: 200, chatId: 11, text: 'other' };
    policyMock.shouldNotify
      .mockResolvedValueOnce({ shouldNotify: true, message })
      .mockResolvedValueOnce({ shouldNotify: true, message: secondMessage });

    await service.dispatchPendingNotifications();

    expect(policyMock.shouldNotify).toHaveBeenCalledTimes(2);
    expect(policyMock.shouldNotify).toHaveBeenCalledWith({
      chatId: 10,
      messageId: 103,
      recipientId: 2,
    });
    expect(policyMock.shouldNotify).toHaveBeenCalledWith({
      chatId: 11,
      messageId: 200,
      recipientId: 2,
    });

    expect(rabbitPublisherMock.publish).toHaveBeenCalledTimes(2);
    expect(rabbitPublisherMock.publish).toHaveBeenCalledWith(
      MESSENGER_EXCHANGE,
      MessengerNotificationsRoutingKey.NewMessage,
      expect.objectContaining({
        eventId: '11111111-2222-3333-4444-555555555555',
        chatId: '10',
        lastMessageId: '103',
        senderId: 1,
        recipientId: 2,
        preview: 'a'.repeat(120),
        missedCount: 3,
        unreadTotal: 7,
        sentAt: message.createdAt.toISOString(),
      }),
    );

    expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledTimes(4);
    expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('e1');
    expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('e2');
    expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('e3');
    expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('e4');
  });

  it('помечает всю группу как SKIPPED, если политика запрещает пуш', async () => {
    const events = [
      createOutboxEvent({
        id: 'e1',
        payload: { chatId: 10, messageId: 101, senderId: 1, recipientId: 2 },
      }),
      createOutboxEvent({
        id: 'e2',
        payload: { chatId: 10, messageId: 102, senderId: 1, recipientId: 2 },
      }),
    ];
    outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue(events);
    policyMock.shouldNotify.mockResolvedValue({
      shouldNotify: false,
      reason: 'recipient_online',
    });

    await service.dispatchPendingNotifications();

    expect(rabbitPublisherMock.publish).not.toHaveBeenCalled();
    expect(outboxRepositoryMock.markAsSkipped).toHaveBeenCalledTimes(2);
    expect(outboxRepositoryMock.markAsSkipped).toHaveBeenCalledWith('e1', 'recipient_online');
    expect(outboxRepositoryMock.markAsSkipped).toHaveBeenCalledWith('e2', 'recipient_online');
    expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
  });

  it('при ошибке publish возвращает события группы в PENDING', async () => {
    const events = [
      createOutboxEvent({
        id: 'e1',
        payload: { chatId: 10, messageId: 101, senderId: 1, recipientId: 2 },
      }),
      createOutboxEvent({
        id: 'e2',
        payload: { chatId: 10, messageId: 102, senderId: 1, recipientId: 2 },
      }),
    ];
    outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue(events);
    rabbitPublisherMock.publish.mockRejectedValue(new Error('Broker timeout'));

    await service.dispatchPendingNotifications();

    expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
    expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledTimes(2);
    expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledWith('e1', 'Broker timeout');
    expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledWith('e2', 'Broker timeout');
  });

  it('помечает события с невалидным payload как SKIPPED', async () => {
    outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([
      {
        id: 'bad',
        type: OutboxEventType.NEW_MESSAGE_NOTIFICATION,
        payload: { chatId: '10' },
        status: OutboxEventStatus.PROCESSING,
        availableAt: new Date(),
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await service.dispatchPendingNotifications();

    expect(outboxRepositoryMock.markAsSkipped).toHaveBeenCalledWith('bad', 'invalid_payload');
    expect(policyMock.shouldNotify).not.toHaveBeenCalled();
  });

  it('при параллельном вызове второй выходит сразу', async () => {
    let releaseLock!: (events: OutboxEvent[]) => void;
    const lockPending = new Promise<OutboxEvent[]>((resolve) => {
      releaseLock = resolve;
    });
    outboxRepositoryMock.lockEventsForProcessing.mockReturnValue(lockPending);

    const firstRun = service.dispatchPendingNotifications();
    const secondRun = service.dispatchPendingNotifications();

    await secondRun;
    expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);

    releaseLock([]);
    await firstRun;
    expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);
  });
});
