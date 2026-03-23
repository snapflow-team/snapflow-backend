import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { OutboxEvent, OutboxEventStatus, OutboxEventType } from '@generated/prisma-files';

describe('OutboxProcessorService (Unit)', () => {
  let service: OutboxProcessorService;
  let storageServiceMock: Record<keyof StorageService, jest.Mock>;
  let outboxRepositoryMock: Record<keyof OutboxRepository, jest.Mock>;
  let configServiceMock: Record<keyof ConfigService, jest.Mock>;

  beforeAll(() => {
    // Фиксируем системное время для предсказуемых тестов очистки (cleanup)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-23T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    storageServiceMock = {
      deleteFile: jest.fn(),
    } as any;

    outboxRepositoryMock = {
      findPendingEvents: jest.fn(),
      markAsProcessed: jest.fn(),
      updateWithError: jest.fn(),
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
      ],
    }).compile();

    service = module.get<OutboxProcessorService>(OutboxProcessorService);

    // Мокаем Logger, чтобы он не спамил в консоль во время успешных тестов
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOutboxEvents()', () => {
    it('должен прервать выполнение и не вызывать другие сервисы, если нет pending событий', async () => {
      outboxRepositoryMock.findPendingEvents.mockResolvedValue([]);

      await service.processOutboxEvents();

      expect(outboxRepositoryMock.findPendingEvents).toHaveBeenCalledWith(50);
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
    });

    it('должен успешно удалить файл из S3 и отметить событие как PROCESSED, если тип DELETE_S3_FILE', async () => {
      const mockEvent: OutboxEvent = {
        id: 'uuid-1',
        type: OutboxEventType.DELETE_S3_FILE,
        payload: { key: 'avatars/user-1/file.png' },
        status: OutboxEventStatus.PENDING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      outboxRepositoryMock.findPendingEvents.mockResolvedValue([mockEvent]);
      storageServiceMock.deleteFile.mockResolvedValue(undefined);

      await service.processOutboxEvents();

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith('avatars/user-1/file.png');
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('uuid-1');
      expect(outboxRepositoryMock.updateWithError).not.toHaveBeenCalled();
    });

    it('должен перехватить ошибку от StorageService и сохранить её в БД (updateWithError)', async () => {
      const mockEvent: OutboxEvent = {
        id: 'uuid-2',
        type: OutboxEventType.DELETE_S3_FILE,
        payload: { key: 'avatars/user-2/error.png' },
        status: OutboxEventStatus.PENDING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      outboxRepositoryMock.findPendingEvents.mockResolvedValue([mockEvent]);
      // Имитируем падение AWS S3
      storageServiceMock.deleteFile.mockRejectedValue(new Error('AWS S3 Timeout'));

      await service.processOutboxEvents();

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith('avatars/user-2/error.png');
      // Событие НЕ должно быть отмечено как успешное
      expect(outboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      // Ошибка должна быть записана в базу для этого события
      expect(outboxRepositoryMock.updateWithError).toHaveBeenCalledWith('uuid-2', 'AWS S3 Timeout');
    });

    it('должен просто отметить событие как PROCESSED, если передан неизвестный тип события', async () => {
      const mockEvent: OutboxEvent = {
        id: 'uuid-3',
        type: 'SOME_UNKNOWN_TYPE' as any, // Эмулируем старое или неизвестное событие
        payload: { key: 'unknown' },
        status: OutboxEventStatus.PENDING,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      outboxRepositoryMock.findPendingEvents.mockResolvedValue([mockEvent]);

      await service.processOutboxEvents();

      // S3 не должен быть вызван
      expect(storageServiceMock.deleteFile).not.toHaveBeenCalled();
      // Но событие должно закрыться, чтобы не висеть вечно в PENDING
      expect(outboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('uuid-3');
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
});
