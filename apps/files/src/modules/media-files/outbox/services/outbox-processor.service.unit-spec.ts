import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { OutboxEvent, OutboxEventStatus, OutboxEventType } from '@generated/prisma-files';
import { OutboxProcessing } from '../constants/outbox.constants';
import { LoggerFactory } from '../../../logger/logger.factory';

function createMockEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'uuid-1',
    type: OutboxEventType.DELETE_S3_FILE,
    payload: { key: 'avatars/user-1/file.png' },
    status: OutboxEventStatus.PENDING,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OutboxProcessorService (Unit)', () => {
  let service: OutboxProcessorService;
  let storageServiceMock: Record<keyof StorageService, jest.Mock>;
  let outboxRepositoryMock: Record<keyof OutboxRepository, jest.Mock>;
  let configServiceMock: Record<keyof ConfigService, jest.Mock>;
  let loggerMock: { log: jest.Mock; error: jest.Mock; warn: jest.Mock };

  beforeAll(() => {
    // Фиксируем системное время для предсказуемых тестов очистки (cleanup)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    loggerMock = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    storageServiceMock = {
      deleteFile: jest.fn(),
    } as any;

    outboxRepositoryMock = {
      lockEventsForProcessing: jest.fn(),
      markAsProcessed: jest.fn(),
      releaseToPending: jest.fn(),
      recoverStaleEvents: jest.fn(),
      deleteProcessedEventsOlderThan: jest.fn(),
      createOutboxEvent: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue({ outboxRetentionDays: 7 }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessorService,
        { provide: StorageService, useValue: storageServiceMock },
        { provide: OutboxRepository, useValue: outboxRepositoryMock },
        { provide: ConfigService, useValue: configServiceMock },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get<OutboxProcessorService>(OutboxProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOutboxEvents()', () => {
    it('должен прервать выполнение и не вызывать другие сервисы, если нет pending событий', async () => {
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([]);

      await service.processOutboxEvents();

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledWith(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
    });

    it('должен успешно удалить файл из S3 и отметить событие как PROCESSED, если тип DELETE_S3_FILE', async () => {
      const mockEvent: OutboxEvent = createMockEvent();

      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([mockEvent]);
      storageServiceMock.deleteFile.mockResolvedValue(undefined);

      await service.processOutboxEvents();

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith('avatars/user-1/file.png');
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('uuid-1');
      expect(outboxRepositoryMock.releaseToPending).not.toHaveBeenCalled();
    });

    it('должен ретраить pending событие и сохранять ошибку через releaseToPending', async () => {
      const mockEvent: OutboxEvent = createMockEvent({
        id: 'uuid-2',
        payload: { key: 'avatars/user-2/error.png' },
      });

      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([mockEvent]);
      // Имитируем падение AWS S3
      storageServiceMock.deleteFile.mockRejectedValue(new Error('AWS S3 Timeout'));

      await service.processOutboxEvents();

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith('avatars/user-2/error.png');
      // Событие НЕ должно быть отмечено как успешное
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      // Ошибка должна быть записана, а статус возвращен в PENDING
      expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledWith(
        'uuid-2',
        'AWS S3 Timeout',
      );
    });

    it('должен просто отметить событие как PROCESSED, если передан неизвестный тип события', async () => {
      const mockEvent: OutboxEvent = createMockEvent({
        id: 'uuid-3',
        type: 'SOME_UNKNOWN_TYPE' as any, // Эмулируем старое или неизвестное событие
        payload: { key: 'unknown' },
      });

      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([mockEvent]);

      await service.processOutboxEvents();

      // S3 не должен быть вызван
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
      // Но событие должно закрыться, чтобы не висеть вечно в PENDING
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('uuid-3');
    });

    it('должен не запускать второй цикл при параллельном вызове (isProcessing guard)', async () => {
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

    it('должен сбрасывать isProcessing в finally после критической ошибки lockEventsForProcessing', async () => {
      outboxRepositoryMock.lockEventsForProcessing
        .mockRejectedValueOnce(new Error('DB down'))
        .mockResolvedValueOnce([]);

      await service.processOutboxEvents();
      await service.processOutboxEvents();

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'DB down' }),
        'processOutboxEvents',
      );
    });
  });

  describe('cleanupProcessedEvents()', () => {
    it('должен вычислить правильную дату и вызвать удаление старых событий', async () => {
      // У нас системное время '2026-03-23T12:00:00.000Z', retentionDays = 7
      // Ожидаемая дата удаления: 2026-03-16T12:00:00.000Z
      const expectedThreshold = new Date('2026-03-16T12:00:00.000Z');

      outboxRepositoryMock.deleteProcessedEventsOlderThan.mockResolvedValue(15); // удалили 15 записей

      await service.cleanupProcessedEvents();

      expect(configServiceMock.get).toHaveBeenCalledWith('microserviceSettings');
      expect(outboxRepositoryMock.deleteProcessedEventsOlderThan).toHaveBeenCalledWith(
        expectedThreshold,
      );
    });
  });

  describe('handleStaleEvents()', () => {
    it('при ненулевом recoverStaleEvents логирует warn', async () => {
      outboxRepositoryMock.recoverStaleEvents.mockResolvedValue(3);

      await service.handleStaleEvents();

      expect(outboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('3'),
        'handleStaleEvents',
      );
    });

    it('при нулевом recoverStaleEvents не логирует warn', async () => {
      outboxRepositoryMock.recoverStaleEvents.mockResolvedValue(0);

      await service.handleStaleEvents();

      expect(outboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(loggerMock.warn).not.toHaveBeenCalled();
    });

    it('при ошибке recoverStaleEvents не пробрасывает исключение', async () => {
      const repoError = new Error('DB connection lost');
      outboxRepositoryMock.recoverStaleEvents.mockRejectedValue(repoError);

      await expect(service.handleStaleEvents()).resolves.toBeUndefined();

      expect(loggerMock.error).toHaveBeenCalledWith(repoError, 'handleStaleEvents');
    });
  });
});
