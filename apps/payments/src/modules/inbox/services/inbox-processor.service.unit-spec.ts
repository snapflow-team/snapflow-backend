import { Test, TestingModule } from '@nestjs/testing';
import { InboxEvent, InboxEventStatus, PaymentProvider } from '@generated/prisma-payments';
import { InboxProcessorService } from './inbox-processor.service';
import { InboxRepository } from '../repositories/inbox.repository';
import { PrismaService } from '../../database/prisma.service';
import { WEBHOOK_HANDLERS } from '../../../core/providers/provide-tokens/webhook-handlers.inject-token';
import { WebhookHandler } from '../../subscriptions/application/webhook/webhook.handler';
import { InboxProcessing } from '../constants/inbox.constants';
import { LoggerFactory } from '../../logger/logger.factory';
import { Notification } from '../../../common/notification/notification';
import { NotificationResultCode } from '../../../common/notification/notification-result-code';
function createMockInboxEvent(overrides: Partial<InboxEvent> = {}): InboxEvent {
  return {
    eventId: 'evt_1',
    provider: PaymentProvider.STRIPE,
    payload: {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1' } },
    } as object,
    status: InboxEventStatus.PROCESSING,
    attempts: 0,
    error: null,
    receivedAt: new Date(),
    processedAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('InboxProcessorService (unit)', () => {
  let service: InboxProcessorService;
  let inboxRepositoryMock: Record<keyof InboxRepository, jest.Mock>;
  let prismaMock: { $transaction: jest.Mock };
  let handlerMock: WebhookHandler;
  let loggerMock: { debug: jest.Mock; error: jest.Mock; warn: jest.Mock };

  const txMock = { inboxEvent: { update: jest.fn() } };

  beforeEach(async () => {
    loggerMock = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    inboxRepositoryMock = {
      tryInsertEvent: jest.fn(),
      lockEventsForProcessing: jest.fn(),
      markAsProcessed: jest.fn(),
      markAsFailed: jest.fn(),
      recoverStaleEvents: jest.fn(),
    };

    prismaMock = {
      $transaction: jest.fn(async (callback: (tx: typeof txMock) => Promise<void>) =>
        callback(txMock),
      ),
    };

    handlerMock = {
      supports: jest.fn().mockReturnValue(true),
      handle: jest.fn().mockResolvedValue(Notification.ok()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxProcessorService,
        { provide: InboxRepository, useValue: inboxRepositoryMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: WEBHOOK_HANDLERS, useValue: [handlerMock] },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get(InboxProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processInboxEvents() — позитивные сценарии', () => {
    it('не вызывает handler, если заблокированный батч пуст', async () => {
      inboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([]);

      await service.processInboxEvents();

      expect(inboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledWith(
        InboxProcessing.LOCK_BATCH_SIZE,
      );
      expect(handlerMock.handle).not.toHaveBeenCalled();
      expect(inboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
    });

    it('вызывает handler в транзакции и помечает inbox как PROCESSED', async () => {
      const inboxEvent = createMockInboxEvent({ eventId: 'evt_ok' });
      inboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([inboxEvent]);
      inboxRepositoryMock.markAsProcessed.mockResolvedValue(undefined);

      await service.processInboxEvents();

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(handlerMock.handle).toHaveBeenCalledWith(
        inboxEvent.payload,
        txMock,
      );
      expect(inboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('evt_ok', txMock);
      expect(inboxRepositoryMock.markAsFailed).not.toHaveBeenCalled();
    });

    it('если handler не найден, помечает событие PROCESSED без транзакции', async () => {
      const inboxEvent = createMockInboxEvent({ eventId: 'evt_no_handler' });
      inboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([inboxEvent]);
      (handlerMock.supports as jest.Mock).mockReturnValue(false);
      inboxRepositoryMock.markAsProcessed.mockResolvedValue(undefined);

      await service.processInboxEvents();

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(handlerMock.handle).not.toHaveBeenCalled();
      expect(inboxRepositoryMock.markAsProcessed).toHaveBeenCalledWith('evt_no_handler');
    });
  });

  describe('processInboxEvents() — ошибки', () => {
    it('при Notification.fail от handler вызывает markAsFailed и не помечает PROCESSED', async () => {
      const inboxEvent = createMockInboxEvent({ eventId: 'evt_fail', attempts: 1 });
      inboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([inboxEvent]);
      (handlerMock.handle as jest.Mock).mockResolvedValue(
        Notification.fail(NotificationResultCode.BadRequest, 'Business error'),
      );
      inboxRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processInboxEvents();

      expect(inboxRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(inboxRepositoryMock.markAsFailed).toHaveBeenCalledWith(
        'evt_fail',
        'Business error',
        1,
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('attempts 2/10'),
        'processInboxEvents',
      );
    });

    it('при исключении handler вызывает markAsFailed с текстом Error', async () => {
      const inboxEvent = createMockInboxEvent({ eventId: 'evt_throw', attempts: 0 });
      inboxRepositoryMock.lockEventsForProcessing.mockResolvedValue([inboxEvent]);
      (handlerMock.handle as jest.Mock).mockRejectedValue(new Error('Handler crashed'));
      inboxRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processInboxEvents();

      expect(inboxRepositoryMock.markAsFailed).toHaveBeenCalledWith(
        'evt_throw',
        'Handler crashed',
        0,
      );
    });

    it('при критической ошибке lockEventsForProcessing логирует и сбрасывает isProcessing', async () => {
      inboxRepositoryMock.lockEventsForProcessing
        .mockRejectedValueOnce(new Error('DB down'))
        .mockResolvedValueOnce([]);

      await service.processInboxEvents();
      await service.processInboxEvents();

      expect(handlerMock.handle).not.toHaveBeenCalled();
      expect(inboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(2);
      expect(loggerMock.error).toHaveBeenCalledWith(expect.any(Error), 'processInboxEvents');
    });
  });

  describe('processInboxEvents() — защита isProcessing', () => {
    it('при параллельном вызове второй выходит сразу, lock вызывается один раз', async () => {
      let releaseLock!: (events: InboxEvent[]) => void;
      const lockPending = new Promise<InboxEvent[]>((resolve) => {
        releaseLock = resolve;
      });
      inboxRepositoryMock.lockEventsForProcessing.mockReturnValue(lockPending);

      const firstRun = service.processInboxEvents();
      const secondRun = service.processInboxEvents();

      await secondRun;

      expect(inboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);

      releaseLock([]);
      await firstRun;

      expect(inboxRepositoryMock.lockEventsForProcessing).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleStaleEvents()', () => {
    it('при наличии зависших событий вызывает recoverStaleEvents и логирует warn', async () => {
      inboxRepositoryMock.recoverStaleEvents.mockResolvedValue(2);

      await service.handleStaleEvents();

      expect(inboxRepositoryMock.recoverStaleEvents).toHaveBeenCalledWith(
        InboxProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('2'),
        'handleStaleEvents',
      );
    });

    it('если зависших событий нет, warn не вызывается', async () => {
      inboxRepositoryMock.recoverStaleEvents.mockResolvedValue(0);

      await service.handleStaleEvents();

      expect(loggerMock.warn).not.toHaveBeenCalled();
    });
  });
});
