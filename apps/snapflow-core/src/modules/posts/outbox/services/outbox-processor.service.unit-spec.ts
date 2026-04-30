import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { FilesClient } from '../../../integrations/files/files.client';
import { OutboxProcessing } from '../constants/outbox.constants';
import {
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
  Prisma,
} from '@generated/prisma-snapflow';

describe('OutboxProcessorService (Unit)', () => {
  let service: OutboxProcessorService;
  let filesClientMock: Record<keyof FilesClient, jest.Mock>;
  let outboxRepositoryMock: Record<keyof OutboxRepository, jest.Mock>;
  let configServiceMock: Record<keyof ConfigService, jest.Mock>;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-22T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    filesClientMock = {
      deleteFile: jest.fn(),
    } as any;

    outboxRepositoryMock = {
      lockEventsForProcessing: jest.fn(),
      markAsProcessed: jest.fn(),
      releaseToPending: jest.fn(),
      recoverStaleEvents: jest.fn(),
      deleteProcessedEventsOlderThan: jest.fn(),
      createOutboxEvent: jest.fn(),
    } as any;

    configServiceMock = {
      get: jest.fn().mockReturnValue({ outboxRetentionDays: 7 }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessorService,
        { provide: FilesClient, useValue: filesClientMock },
        { provide: OutboxRepository, useValue: outboxRepositoryMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<OutboxProcessorService>(OutboxProcessorService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOutboxEvents()', () => {
    it('должен завершиться без действий, если pending-событий нет', async () => {
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([]);

      await service.processOutboxEvents();

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledWith(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );
      expect(filesClientMock.deleteFile).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
    });

    it('должен отправить deleteFile и отметить событие как PROCESSED', async () => {
      const event: OutboxEvent = {
        id: 'event-1',
        type: OutboxEventType.DELETE_POST_MEDIA_FILE,
        payload: {
          userId: 1,
          fileUrl: 'https://cdn.test/files/11111111-1111-4111-8111-111111111111',
        } as Prisma.JsonObject,
        status: OutboxEventStatus.PROCESSING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([event]);
      filesClientMock.deleteFile.mockResolvedValue({ success: true });

      await service.processOutboxEvents();

      expect(filesClientMock.deleteFile).toHaveBeenCalledWith({
        userId: 1,
        fileUrl: 'https://cdn.test/files/11111111-1111-4111-8111-111111111111',
      });
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('event-1');
      expect(outboxRepositoryMock.releaseToPending).not.toHaveBeenCalled();
    });

    it('должен сохранить ошибку, если deleteFile завершился исключением', async () => {
      const event: OutboxEvent = {
        id: 'event-2',
        type: OutboxEventType.DELETE_POST_MEDIA_FILE,
        payload: {
          userId: 2,
          fileUrl: 'https://cdn.test/files/22222222-2222-4222-8222-222222222222',
        } as Prisma.JsonObject,
        status: OutboxEventStatus.PROCESSING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([event]);
      filesClientMock.deleteFile.mockRejectedValue(new Error('RPC timeout'));

      await service.processOutboxEvents();

      expect(filesClientMock.deleteFile).toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledWith('event-2', 'RPC timeout');
    });

    it('должен ретраить pending событие: после падения files затем успешно обработать', async () => {
      const event: OutboxEvent = {
        id: 'event-retry',
        type: OutboxEventType.DELETE_POST_MEDIA_FILE,
        payload: {
          userId: 7,
          fileUrl: 'https://cdn.test/files/77777777-7777-4777-8777-777777777777',
        } as Prisma.JsonObject,
        status: OutboxEventStatus.PROCESSING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      outboxRepositoryMock.lockEventsForProcessing
        .mockResolvedValueOnce([event]) // files service down
        .mockResolvedValueOnce([event]); // files service recovered

      filesClientMock.deleteFile
        .mockRejectedValueOnce(new Error('Files service unavailable'))
        .mockResolvedValueOnce({ success: true });

      await service.processOutboxEvents();
      await service.processOutboxEvents();

      expect(filesClientMock.deleteFile).toHaveBeenCalledTimes(2);
      expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledWith(
        'event-retry',
        'Files service unavailable',
      );
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('event-retry');
    });

    it('должен сохранять ошибку, если payload имеет неверный формат', async () => {
      const event: OutboxEvent = {
        id: 'event-3',
        type: OutboxEventType.DELETE_POST_MEDIA_FILE,
        payload: { userId: 'not-number', fileUrl: 123 } as Prisma.JsonObject,
        status: OutboxEventStatus.PROCESSING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      outboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([event]);

      await service.processOutboxEvents();

      expect(filesClientMock.deleteFile).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.releaseToPending).toHaveBeenCalledWith(
        'event-3',
        `Invalid payload for event type ${OutboxEventType.DELETE_POST_MEDIA_FILE}`,
      );
    });

    it('при параллельном вызове второй выходит сразу, lockEventsForProcessing вызывается один раз', async () => {
      let releaseLock!: (events: OutboxEvent[]) => void;
      const lockPromise = new Promise<OutboxEvent[]>((resolve) => {
        releaseLock = resolve;
      });
      outboxRepositoryMock.lockEventsForProcessing.mockReturnValue(lockPromise);

      const firstRun = service.processOutboxEvents();
      const secondRun = service.processOutboxEvents();

      await secondRun;

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);

      releaseLock([]);
      await firstRun;
    });

    it('после критической ошибки lockEventsForProcessing повторный вызов снова работает', async () => {
      const event: OutboxEvent = {
        id: 'event-after-critical',
        type: OutboxEventType.DELETE_POST_MEDIA_FILE,
        payload: {
          userId: 9,
          fileUrl: 'https://cdn.test/files/99999999-9999-4999-8999-999999999999',
        } as Prisma.JsonObject,
        status: OutboxEventStatus.PROCESSING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      outboxRepositoryMock.lockEventsForProcessing
        .mockRejectedValueOnce(new Error('DB down'))
        .mockResolvedValueOnce([event]);
      filesClientMock.deleteFile.mockResolvedValue({ success: true });

      await service.processOutboxEvents();
      await service.processOutboxEvents();

      expect(outboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(2);
      expect(filesClientMock.deleteFile).toHaveBeenCalledTimes(1);
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('event-after-critical');
    });
  });

  describe('handleStaleEvents()', () => {
    it('при ненулевом recoveredCount логирует warn', async () => {
      outboxRepositoryMock.recoverStaleEvents.mockResolvedValue(3);

      await service.handleStaleEvents();

      expect(outboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('3 stale events'));
    });

    it('при нулевом recoveredCount не логирует warn', async () => {
      outboxRepositoryMock.recoverStaleEvents.mockResolvedValue(0);

      await service.handleStaleEvents();

      expect(outboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(Logger.prototype.warn).not.toHaveBeenCalled();
    });

    it('при ошибке recoverStaleEvents не пробрасывает исключение', async () => {
      const repoError = new Error('DB connection lost');
      outboxRepositoryMock.recoverStaleEvents.mockRejectedValue(repoError);

      await expect(service.handleStaleEvents()).resolves.toBeUndefined();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to recover stale events',
        repoError,
      );
    });
  });

  describe('cleanupProcessedEvents()', () => {
    it('должен вычислить пороговую дату и вызвать удаление старых событий', async () => {
      const expectedThreshold = new Date('2026-04-15T12:00:00.000Z');
      outboxRepositoryMock.deleteProcessedEventsOlderThan.mockResolvedValue(5);

      await service.cleanupProcessedEvents();

      expect(configServiceMock.get).toHaveBeenCalledWith('businessRulesSettings');
      expect(outboxRepositoryMock.deleteProcessedEventsOlderThan).toHaveBeenCalledWith(
        expectedThreshold,
      );
    });
  });
});
