import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OutboxEvent, OutboxEventStatus, OutboxEventType } from '@generated/prisma-payments';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { RabbitMQPublisherService } from './rabbitmq-publisher.service';
import { PAYMENTS_EXCHANGE } from '../../../../../../libs/contracts/payments';
import { OutboxProcessing } from '../constants/outbox.constants';

function createMockEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'uuid-1',
    type: OutboxEventType.PAYMENT_COMPLETED,
    payload: { subscriptionId: 'sub-123' },
    status: OutboxEventStatus.PENDING,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OutboxProcessorService (unit)', () => {
  let service: OutboxProcessorService;
  let outboxRepositoryMock: Record<keyof OutboxRepository, jest.Mock>;
  let rabbitPublisherMock: Record<keyof RabbitMQPublisherService, jest.Mock>;

  beforeEach(async () => {
    outboxRepositoryMock = {
      saveEvent: jest.fn(),
      lockEventsForProcessing: jest.fn(),
      markAsProcessed: jest.fn(),
      markAsFailed: jest.fn(),
      recoverStaleEvents: jest.fn(),
    };

    rabbitPublisherMock = {
      publish: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessorService,
        { provide: OutboxRepository, useValue: outboxRepositoryMock },
        { provide: RabbitMQPublisherService, useValue: rabbitPublisherMock },
      ],
    }).compile();

    service = module.get<OutboxProcessorService>(OutboxProcessorService);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOutboxEvents() — Позитивные сценарии', () => {
    it('не вызывает publish и пометки статуса, если заблокированный батч пуст', async () => {
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([]);

      await service.processOutboxEvents();

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledWith(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );
      expect(rabbitPublisherMock.publish).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsFailed).not.toHaveBeenCalled();
    });

    it('публикует одно событие в брокер и помечает его как обработанное', async () => {
      const event = createMockEvent();
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([event]);
      rabbitPublisherMock.publish.mockResolvedValue(undefined);
      outboxRepositoryMock.markAsProcessed.mockResolvedValue(undefined);

      await service.processOutboxEvents();

      expect(rabbitPublisherMock.publish).toHaveBeenCalledTimes(1);
      expect(rabbitPublisherMock.publish).toHaveBeenCalledWith(
        PAYMENTS_EXCHANGE,
        event.type,
        event.payload,
      );
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledTimes(1);
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith(event.id);
      expect(outboxRepositoryMock.markAsFailed).not.toHaveBeenCalled();
    });

    it('обрабатывает несколько событий по очереди: для каждого сначала publish, затем markAsProcessed', async () => {
      const first = createMockEvent({ id: 'uuid-1' });
      const second = createMockEvent({
        id: 'uuid-2',
        type: OutboxEventType.PAYMENT_FAILED,
        payload: { reason: 'declined' },
      });
      const third = createMockEvent({ id: 'uuid-3' });
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([first, second, third]);

      const stepLog: string[] = [];
      rabbitPublisherMock.publish.mockImplementation(async (exchange, type, payload) => {
        stepLog.push(`publish:${type}`);
        expect(exchange).toBe(PAYMENTS_EXCHANGE);
        expect(payload).toBeDefined();
      });
      outboxRepositoryMock.markAsProcessed.mockImplementation(async (id: string) => {
        stepLog.push(`mark:${id}`);
      });

      await service.processOutboxEvents();

      expect(stepLog).toEqual([
        `publish:${first.type}`,
        `mark:${first.id}`,
        `publish:${second.type}`,
        `mark:${second.id}`,
        `publish:${third.type}`,
        `mark:${third.id}`,
      ]);

      expect(rabbitPublisherMock.publish).toHaveBeenNthCalledWith(
        1,
        PAYMENTS_EXCHANGE,
        first.type,
        first.payload,
      );
      expect(rabbitPublisherMock.publish).toHaveBeenNthCalledWith(
        2,
        PAYMENTS_EXCHANGE,
        second.type,
        second.payload,
      );
      expect(rabbitPublisherMock.publish).toHaveBeenNthCalledWith(
        3,
        PAYMENTS_EXCHANGE,
        third.type,
        third.payload,
      );

      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenNthCalledWith(1, first.id);
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenNthCalledWith(2, second.id);
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenNthCalledWith(3, third.id);
    });
  });

  describe('processOutboxEvents() — Ошибки', () => {
    it('при ошибке publish вызывает markAsFailed с текстом Error и не вызывает markAsProcessed', async () => {
      const event = createMockEvent({ id: 'uuid-fail' });
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([event]);
      rabbitPublisherMock.publish.mockRejectedValue(new Error('Broker timeout'));
      outboxRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processOutboxEvents();

      expect(rabbitPublisherMock.publish).toHaveBeenCalledWith(
        PAYMENTS_EXCHANGE,
        event.type,
        event.payload,
      );
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsFailed).toHaveBeenCalledTimes(1);
      expect(outboxRepositoryMock.markAsFailed).toHaveBeenCalledWith(event.id, 'Broker timeout');
    });

    it('при отклонении publish не-Error передаёт в markAsFailed сообщение Unknown broker error', async () => {
      const event = createMockEvent({ id: 'uuid-non-error' });
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([event]);
      rabbitPublisherMock.publish.mockRejectedValue('timeout');
      outboxRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processOutboxEvents();

      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsFailed).toHaveBeenCalledWith(
        event.id,
        'Unknown broker error',
      );
    });

    it('при падении publish у одного из батча остальные помечаются PROCESSED, упавшее — FAILED', async () => {
      const first = createMockEvent({ id: 'uuid-1' });
      const second = createMockEvent({ id: 'uuid-2' });
      const third = createMockEvent({ id: 'uuid-3' });
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([first, second, third]);

      rabbitPublisherMock.publish
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Broker timeout'))
        .mockResolvedValueOnce(undefined);

      outboxRepositoryMock.markAsProcessed.mockResolvedValue(undefined);
      outboxRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processOutboxEvents();

      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledTimes(2);
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith(first.id);
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith(third.id);
      expect(outboxRepositoryMock.markAsFailed).toHaveBeenCalledTimes(1);
      expect(outboxRepositoryMock.markAsFailed).toHaveBeenCalledWith(second.id, 'Broker timeout');
    });

    it('при критической ошибке lockEventsForProcessing не вызывает publish, логирует и сбрасывает isProcessing', async () => {
      outboxRepositoryMock.lockEventsForProcessing
        .mockRejectedValueOnce(new Error('DB down'))
        .mockResolvedValueOnce([]);

      await service.processOutboxEvents();
      await service.processOutboxEvents();

      expect(rabbitPublisherMock.publish).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(2);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Critical failure in outbox processor loop',
        expect.stringContaining('DB down'),
      );
    });
  });

  describe('processOutboxEvents() — защита isProcessing', () => {
    it('при параллельном вызове второй выходит сразу, lockEventsForProcessing вызывается один раз', async () => {
      let releaseLock!: (events: OutboxEvent[]) => void;
      const lockPending = new Promise<OutboxEvent[]>((resolve) => {
        releaseLock = resolve;
      });
      outboxRepositoryMock.lockEventsForProcessing.mockReturnValue(lockPending);

      const firstRun: Promise<void> = service.processOutboxEvents();
      const secondRun: Promise<void> = service.processOutboxEvents();

      await secondRun;

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);

      releaseLock([]);
      await firstRun;

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);
    });

    it('после критической ошибки повторный вызов снова заходит в цикл и обрабатывает батч', async () => {
      const event = createMockEvent({ id: 'uuid-after-critical' });
      outboxRepositoryMock.lockEventsForProcessing
        .mockRejectedValueOnce(new Error('DB down'))
        .mockResolvedValueOnce([event]);
      rabbitPublisherMock.publish.mockResolvedValue(undefined);
      outboxRepositoryMock.markAsProcessed.mockResolvedValue(undefined);

      await service.processOutboxEvents();
      await service.processOutboxEvents();

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(2);
      expect(rabbitPublisherMock.publish).toHaveBeenCalledTimes(1);
      expect(rabbitPublisherMock.publish).toHaveBeenCalledWith(
        PAYMENTS_EXCHANGE,
        event.type,
        event.payload,
      );
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith(event.id);
    });
  });

  describe('handleStaleEvents()', () => {
    it('при наличии зависших событий вызывает recoverStaleEvents и логирует предупреждение с количеством', async () => {
      outboxRepositoryMock.recoverStaleEvents.mockResolvedValue(3);

      await service.handleStaleEvents();

      expect(outboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('3'));
    });

    it('если зависших событий нет, не вызывает warn', async () => {
      outboxRepositoryMock.recoverStaleEvents.mockResolvedValue(0);

      await service.handleStaleEvents();

      expect(outboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('при ошибке recoverStaleEvents логирует ошибку и не пробрасывает исключение', async () => {
      const repoError = new Error('DB connection lost');
      outboxRepositoryMock.recoverStaleEvents.mockRejectedValue(repoError);

      await expect(service.handleStaleEvents()).resolves.toBeUndefined();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to recover stale events',
        repoError,
      );
    });
  });
});
