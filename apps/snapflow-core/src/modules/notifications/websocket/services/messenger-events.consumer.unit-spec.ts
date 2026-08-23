import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { MessengerNotificationsRoutingKey } from '../../../../../../../libs/contracts/messenger';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../../../../../../../libs/common/constants/request-id.constants';
import { LoggerFactory } from '../../../logger/logger.factory';
import { AsyncLocalStorageService } from '../../../../common/async-local-storage/async-local-storage.service';
import { MessengerEventsConsumer } from './messenger-events.consumer';
import { MessengerNotificationService } from './messenger-notification.service';

function createConsumeMessage(routingKey: string, payload: unknown): ConsumeMessage {
  return {
    fields: { routingKey } as ConsumeMessage['fields'],
    content: Buffer.from(JSON.stringify(payload)),
    properties: { headers: {} },
  } as ConsumeMessage;
}

function createConsumeMessageWithContent(routingKey: string, content: Buffer): ConsumeMessage {
  return {
    fields: { routingKey } as ConsumeMessage['fields'],
    content,
    properties: { headers: {} },
  } as ConsumeMessage;
}

type HandleMessageFn = (channel: ConfirmChannel, msg: ConsumeMessage) => Promise<void>;

function getHandleMessage(consumer: MessengerEventsConsumer): HandleMessageFn {
  const bound = (consumer as unknown as { handleMessage: HandleMessageFn }).handleMessage.bind(
    consumer,
  );
  return bound as HandleMessageFn;
}

type DispatchMessageFn = (channel: ConfirmChannel, msg: ConsumeMessage) => void;

function getDispatchMessageWithRequestContext(consumer: MessengerEventsConsumer): DispatchMessageFn {
  const bound = (
    consumer as unknown as { dispatchMessageWithRequestContext: DispatchMessageFn }
  ).dispatchMessageWithRequestContext.bind(consumer);
  return bound as DispatchMessageFn;
}

describe('MessengerEventsConsumer.handleMessage() (unit)', () => {
  let consumer: MessengerEventsConsumer;
  let handleMessage: HandleMessageFn;
  let messengerNotificationServiceMock: { applyRoutingKey: jest.Mock };
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(async () => {
    messengerNotificationServiceMock = {
      applyRoutingKey: jest.fn().mockResolvedValue(undefined),
    };

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessengerEventsConsumer,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MessengerNotificationService, useValue: messengerNotificationServiceMock },
        {
          provide: AsyncLocalStorageService,
          useValue: {
            start: jest.fn((callback: () => void) => callback()),
            getStore: jest.fn(() => new Map<string, unknown>()),
          },
        },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    consumer = module.get(MessengerEventsConsumer);
    handleMessage = getHandleMessage(consumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createChannelMock(): { ack: jest.Mock; nack: jest.Mock } {
    return {
      ack: jest.fn(),
      nack: jest.fn(),
    };
  }

  it('при валидном routing key вызывает applyRoutingKey и делает ack', async () => {
    const channelMock = createChannelMock();
    const payload = {
      eventId: '11111111-2222-3333-4444-555555555555',
      chatId: '10',
      lastMessageId: '100',
      senderId: 1,
      recipientId: 2,
      preview: 'hello',
      missedCount: 1,
      unreadTotal: 1,
      sentAt: '2026-08-22T12:00:00.000Z',
    };
    const msg = createConsumeMessage(MessengerNotificationsRoutingKey.NewMessage, payload);

    await handleMessage(channelMock as unknown as ConfirmChannel, msg);

    expect(messengerNotificationServiceMock.applyRoutingKey).toHaveBeenCalledWith(
      MessengerNotificationsRoutingKey.NewMessage,
      payload,
    );
    expect(channelMock.ack).toHaveBeenCalledWith(msg);
    expect(channelMock.nack).not.toHaveBeenCalled();
  });

  it('при неизвестном routing key логирует warn, делает ack и не вызывает applyRoutingKey', async () => {
    const channelMock = createChannelMock();
    const msg = createConsumeMessage('unknown.key', {});

    await handleMessage(channelMock as unknown as ConfirmChannel, msg);

    expect(messengerNotificationServiceMock.applyRoutingKey).not.toHaveBeenCalled();
    expect(channelMock.ack).toHaveBeenCalledWith(msg);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Unhandled routing key "unknown.key" on queue "unknown"',
      'handleMessage',
    );
  });

  it('при ошибке applyRoutingKey делает nack с requeue=true', async () => {
    const channelMock = createChannelMock();
    const syncError = new Error('handler failed');
    messengerNotificationServiceMock.applyRoutingKey.mockRejectedValueOnce(syncError);

    const msg = createConsumeMessage(MessengerNotificationsRoutingKey.NewMessage, {
      eventId: '11111111-2222-3333-4444-555555555555',
    });

    await handleMessage(channelMock as unknown as ConfirmChannel, msg);

    expect(channelMock.nack).toHaveBeenCalledWith(msg, false, true);
    expect(channelMock.ack).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(syncError, 'handleMessage');
  });

  it('при невалидном JSON делает nack и логирует ошибку', async () => {
    const channelMock = createChannelMock();
    const msg = createConsumeMessageWithContent(
      MessengerNotificationsRoutingKey.NewMessage,
      Buffer.from('not json'),
    );

    await handleMessage(channelMock as unknown as ConfirmChannel, msg);

    expect(channelMock.nack).toHaveBeenCalledWith(msg, false, true);
    expect(loggerMock.error).toHaveBeenCalled();
  });
});

describe('MessengerEventsConsumer.dispatchMessageWithRequestContext() (unit)', () => {
  let consumer: MessengerEventsConsumer;
  let dispatchMessageWithRequestContext: DispatchMessageFn;
  let alsMock: { start: jest.Mock; getStore: jest.Mock };

  beforeEach(async () => {
    const store = new Map<string, unknown>();
    alsMock = {
      start: jest.fn((callback: () => void) => {
        store.clear();
        callback();
      }),
      getStore: jest.fn(() => store),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessengerEventsConsumer,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: MessengerNotificationService,
          useValue: { applyRoutingKey: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: AsyncLocalStorageService, useValue: alsMock },
        {
          provide: LoggerFactory,
          useValue: {
            create: jest.fn().mockReturnValue({
              log: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    consumer = module.get(MessengerEventsConsumer);
    dispatchMessageWithRequestContext = getDispatchMessageWithRequestContext(consumer);
  });

  it('кладёт requestId из AMQP headers в ALS store перед handleMessage', async () => {
    const channelStub = {
      ack: jest.fn(),
      nack: jest.fn(),
    };

    const requestIdFromHeader = 'req-from-rabbit';
    const msg = {
      fields: {
        routingKey: MessengerNotificationsRoutingKey.NewMessage,
      } as ConsumeMessage['fields'],
      content: Buffer.from(
        JSON.stringify({
          eventId: '11111111-2222-3333-4444-555555555555',
          chatId: '10',
          lastMessageId: '100',
          senderId: 1,
          recipientId: 2,
          preview: 'hello',
          missedCount: 1,
          unreadTotal: 1,
          sentAt: '2026-08-22T12:00:00.000Z',
        }),
      ),
      properties: { headers: { [REQUEST_ID_HEADER]: requestIdFromHeader } },
    } as unknown as ConsumeMessage;

    dispatchMessageWithRequestContext(channelStub as unknown as ConfirmChannel, msg);

    await new Promise((r) => setImmediate(r));

    expect(alsMock.start).toHaveBeenCalled();
    expect(alsMock.getStore()?.get(REQUEST_ID_KEY)).toBe(requestIdFromHeader);
    expect(channelStub.ack).toHaveBeenCalledWith(msg);
  });
});
