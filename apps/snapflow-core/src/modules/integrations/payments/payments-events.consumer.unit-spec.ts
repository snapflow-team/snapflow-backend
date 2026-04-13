import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { PaymentsRoutingKey } from '../../../../../../libs/contracts/payments';
import { PaymentsEventsConsumer } from './payments-events.consumer';
import { PaymentsUserSyncService } from './payments-user-sync.service';

jest.mock('./payments-user-sync.service', () => ({
  PaymentsUserSyncService: class PaymentsUserSyncService {},
}));

function createConsumeMessage(routingKey: string, payload: unknown): ConsumeMessage {
  return {
    fields: { routingKey } as ConsumeMessage['fields'],
    content: Buffer.from(JSON.stringify(payload)),
  } as ConsumeMessage;
}

function createConsumeMessageWithContent(routingKey: string, content: Buffer): ConsumeMessage {
  return {
    fields: { routingKey } as ConsumeMessage['fields'],
    content,
  } as ConsumeMessage;
}

type HandleMessageFn = (channel: ConfirmChannel, msg: ConsumeMessage) => Promise<void>;

function getHandleMessage(consumer: PaymentsEventsConsumer): HandleMessageFn {
  return (consumer as unknown as { handleMessage: HandleMessageFn }).handleMessage.bind(consumer);
}

describe('PaymentsEventsConsumer.handleMessage() (unit)', () => {
  let consumer: PaymentsEventsConsumer;
  let handleMessage: HandleMessageFn;
  let paymentsUserSyncServiceMock: Record<
    keyof Pick<PaymentsUserSyncService, 'applyRoutingKey'>,
    jest.Mock
  >;

  beforeEach(async () => {
    paymentsUserSyncServiceMock = {
      applyRoutingKey: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsEventsConsumer,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PaymentsUserSyncService, useValue: paymentsUserSyncServiceMock },
      ],
    }).compile();

    consumer = module.get<PaymentsEventsConsumer>(PaymentsEventsConsumer);
    handleMessage = getHandleMessage(consumer);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createChannelMock(): ConfirmChannel {
    const channel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };

    return channel as unknown as ConfirmChannel;
  }

  describe('позитивные сценарии', () => {
    it('при валидном routing key вызывает applyRoutingKey и делает ack', async () => {
      const channelMock = createChannelMock();
      const payload = { userId: 1, planId: 'p1', subscriptionId: 2, currentPeriodEnd: null };
      const msg = createConsumeMessage(PaymentsRoutingKey.PaymentCompleted, payload);

      await handleMessage(channelMock, msg);

      expect(paymentsUserSyncServiceMock.applyRoutingKey).toHaveBeenCalledWith(
        PaymentsRoutingKey.PaymentCompleted,
        payload,
      );
      expect(channelMock.ack).toHaveBeenCalledWith(msg);
      expect(channelMock.nack).not.toHaveBeenCalled();
    });

    it('при неизвестном routing key логирует warn, делает ack и не вызывает applyRoutingKey', async () => {
      const channelMock = createChannelMock();
      const msg = createConsumeMessage('unknown.key', {});

      await handleMessage(channelMock, msg);

      expect(paymentsUserSyncServiceMock.applyRoutingKey).not.toHaveBeenCalled();
      expect(channelMock.ack).toHaveBeenCalledWith(msg);
      expect(Logger.prototype.warn).toHaveBeenCalled();
    });
  });

  describe('ошибки', () => {
    it('при ошибке Error в applyRoutingKey делает nack с requeue=true и логирует ошибку', async () => {
      const channelMock = createChannelMock();
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      paymentsUserSyncServiceMock.applyRoutingKey.mockRejectedValueOnce(new Error('sync failed'));

      const msg = createConsumeMessage(PaymentsRoutingKey.PaymentCompleted, {
        userId: 1,
        planId: 'p',
        subscriptionId: 2,
        currentPeriodEnd: null,
      });

      await handleMessage(channelMock, msg);

      expect(channelMock.nack).toHaveBeenCalledWith(msg, false, true);
      expect(channelMock.ack).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Payments event handling failed: sync failed',
        expect.stringContaining('sync failed'),
      );
    });

    it('при отклонении applyRoutingKey не-Error объектом делает nack и логирует "Unknown error"', async () => {
      const channelMock = createChannelMock();
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      paymentsUserSyncServiceMock.applyRoutingKey.mockRejectedValueOnce('something');

      const msg = createConsumeMessage(PaymentsRoutingKey.PaymentCompleted, {
        userId: 1,
        planId: 'p',
        subscriptionId: 2,
        currentPeriodEnd: null,
      });

      await handleMessage(channelMock, msg);

      expect(channelMock.nack).toHaveBeenCalledWith(msg, false, true);
      expect(errorSpy).toHaveBeenCalledWith('Payments event handling failed: Unknown error', '');
    });

    it('при невалидном JSON в msg.content делает nack и логирует ошибку', async () => {
      const channelMock = createChannelMock();
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const msg = createConsumeMessageWithContent(
        PaymentsRoutingKey.PaymentCompleted,
        Buffer.from('not json'),
      );

      await handleMessage(channelMock, msg);

      expect(channelMock.nack).toHaveBeenCalledWith(msg, false, true);
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
