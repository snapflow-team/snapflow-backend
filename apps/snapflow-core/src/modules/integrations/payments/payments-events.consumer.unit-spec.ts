import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { PaymentsRoutingKey } from '../../../../../../libs/contracts/payments';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../../../../../../libs/common/constants/request-id.constants';
import { PaymentsEventsConsumer } from './payments-events.consumer';
import { PaymentsUserSyncService } from './payments-user-sync.service';
import { LoggerFactory } from '../../logger/logger.factory';
import { AsyncLocalStorageService } from '../../../common/async-local-storage/async-local-storage.service';

jest.mock('./payments-user-sync.service', () => ({
  PaymentsUserSyncService: class PaymentsUserSyncService {},
}));

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

function getHandleMessage(consumer: PaymentsEventsConsumer): HandleMessageFn {
  const bound = (
    consumer as unknown as { handleMessage: HandleMessageFn }
  ).handleMessage.bind(consumer);
  return bound as HandleMessageFn;
}

type DispatchMessageFn = (channel: ConfirmChannel, msg: ConsumeMessage) => void;

function getDispatchMessageWithRequestContext(consumer: PaymentsEventsConsumer): DispatchMessageFn {
  const bound = (
    consumer as unknown as { dispatchMessageWithRequestContext: DispatchMessageFn }
  ).dispatchMessageWithRequestContext.bind(consumer);
  return bound as DispatchMessageFn;
}

describe('PaymentsEventsConsumer.handleMessage() (unit)', () => {
  let consumer: PaymentsEventsConsumer;
  let handleMessage: HandleMessageFn;
  let paymentsUserSyncServiceMock: Record<
    keyof Pick<PaymentsUserSyncService, 'applyRoutingKey'>,
    jest.Mock
  >;
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };
  let alsStartMock: jest.Mock;

  beforeEach(async () => {
    paymentsUserSyncServiceMock = {
      applyRoutingKey: jest.fn().mockResolvedValue(undefined),
    };

    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    alsStartMock = jest.fn((callback: () => void) => {
      callback();
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsEventsConsumer,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PaymentsUserSyncService, useValue: paymentsUserSyncServiceMock },
        {
          provide: AsyncLocalStorageService,
          useValue: {
            start: alsStartMock,
            getStore: jest.fn(() => new Map<string, unknown>()),
          },
        },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    consumer = module.get<PaymentsEventsConsumer>(PaymentsEventsConsumer);
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

  describe('позитивные сценарии', () => {
    it('при валидном routing key вызывает applyRoutingKey и делает ack', async () => {
      const channelMock = createChannelMock();
      const payload = { userId: 1, planId: 'p1', subscriptionId: 2, currentPeriodEnd: null };
      const msg = createConsumeMessage(PaymentsRoutingKey.SubscriptionActivated, payload);

      await handleMessage(channelMock as unknown as ConfirmChannel, msg);

      expect(jest.mocked(paymentsUserSyncServiceMock.applyRoutingKey)).toHaveBeenCalledWith(
        PaymentsRoutingKey.SubscriptionActivated,
        payload,
      );
      expect(jest.mocked(channelMock.ack)).toHaveBeenCalledWith(msg);
      expect(jest.mocked(channelMock.nack)).not.toHaveBeenCalled();
    });

    it('при неизвестном routing key логирует warn, делает ack и не вызывает applyRoutingKey', async () => {
      const channelMock = createChannelMock();
      const msg = createConsumeMessage('unknown.key', {});

      await handleMessage(channelMock as unknown as ConfirmChannel, msg);

      expect(jest.mocked(paymentsUserSyncServiceMock.applyRoutingKey)).not.toHaveBeenCalled();
      expect(jest.mocked(channelMock.ack)).toHaveBeenCalledWith(msg);
      expect(jest.mocked(loggerMock.warn)).toHaveBeenCalledWith(
        'Unhandled routing key: unknown.key',
        'handleMessage',
      );
    });
  });

  describe('ошибки', () => {
    it('при ошибке Error в applyRoutingKey делает nack с requeue=true и логирует ошибку', async () => {
      const channelMock = createChannelMock();
      const syncError = new Error('sync failed');
      paymentsUserSyncServiceMock.applyRoutingKey.mockRejectedValueOnce(syncError);

      const msg = createConsumeMessage(PaymentsRoutingKey.SubscriptionActivated, {
        userId: 1,
        planId: 'p',
        subscriptionId: 2,
        currentPeriodEnd: null,
      });

      await handleMessage(channelMock as unknown as ConfirmChannel, msg);

      expect(jest.mocked(channelMock.nack)).toHaveBeenCalledWith(msg, false, true);
      expect(jest.mocked(channelMock.ack)).not.toHaveBeenCalled();
      expect(jest.mocked(loggerMock.error)).toHaveBeenCalledWith(syncError, 'handleMessage');
    });

    it('при отклонении applyRoutingKey не-Error объектом делает nack и логирует значение', async () => {
      const channelMock = createChannelMock();
      paymentsUserSyncServiceMock.applyRoutingKey.mockRejectedValueOnce('something');

      const msg = createConsumeMessage(PaymentsRoutingKey.SubscriptionActivated, {
        userId: 1,
        planId: 'p',
        subscriptionId: 2,
        currentPeriodEnd: null,
      });

      await handleMessage(channelMock as unknown as ConfirmChannel, msg);

      expect(jest.mocked(channelMock.nack)).toHaveBeenCalledWith(msg, false, true);
      expect(jest.mocked(loggerMock.error)).toHaveBeenCalledWith('"something"', 'handleMessage');
    });

    it('при невалидном JSON в msg.content делает nack и логирует ошибку', async () => {
      const channelMock = createChannelMock();
      const msg = createConsumeMessageWithContent(
        PaymentsRoutingKey.SubscriptionActivated,
        Buffer.from('not json'),
      );

      await handleMessage(channelMock as unknown as ConfirmChannel, msg);

      expect(jest.mocked(channelMock.nack)).toHaveBeenCalledWith(msg, false, true);
      expect(jest.mocked(loggerMock.error)).toHaveBeenCalled();
    });
  });
});

describe('PaymentsEventsConsumer.dispatchMessageWithRequestContext() (unit)', () => {
  let consumer: PaymentsEventsConsumer;
  let dispatchMessageWithRequestContext: DispatchMessageFn;
  let alsMock: { start: jest.Mock; getStore: jest.Mock };
  let loggerMock: { log: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(async () => {
    loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

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
        PaymentsEventsConsumer,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: PaymentsUserSyncService,
          useValue: { applyRoutingKey: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: AsyncLocalStorageService, useValue: alsMock },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    consumer = module.get<PaymentsEventsConsumer>(PaymentsEventsConsumer);
    dispatchMessageWithRequestContext = getDispatchMessageWithRequestContext(consumer);
  });

  it('кладёт requestId из AMQP headers в ALS store перед handleMessage', async () => {
    const channelStub = {
      ack: jest.fn(),
      nack: jest.fn(),
    };

    const requestIdFromHeader = 'req-from-rabbit';
    const msg = {
      fields: { routingKey: PaymentsRoutingKey.SubscriptionActivated } as ConsumeMessage['fields'],
      content: Buffer.from(
        JSON.stringify({ userId: 1, planId: 'p', subscriptionId: 2, currentPeriodEnd: null }),
      ),
      properties: { headers: { [REQUEST_ID_HEADER]: requestIdFromHeader } },
    } as unknown as ConsumeMessage;

    dispatchMessageWithRequestContext(channelStub as unknown as ConfirmChannel, msg);

    await new Promise((r) => setImmediate(r));

    expect(jest.mocked(alsMock.start)).toHaveBeenCalled();
    expect(alsMock.getStore()?.get(REQUEST_ID_KEY)).toBe(requestIdFromHeader);
    expect(jest.mocked(channelStub.ack)).toHaveBeenCalledWith(msg);
  });
});
