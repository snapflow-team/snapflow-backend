import { Test, TestingModule } from '@nestjs/testing';
import {
  OutboxCommand,
  OutboxCommandStatus,
  OutboxCommandType,
} from '@generated/prisma-payments';
import { OutboxCommandProcessorService } from './outbox-command-processor.service';
import { OutboxCommandRepository } from '../repositories/outbox-command.repository';
import { StripeExtendSubscriptionExecutor } from '../executors/stripe-extend-subscription.executor';
import { OutboxCommandProcessing } from '../constants/outbox-command.constants';
import { LoggerFactory } from '../../logger/logger.factory';

function createMockCommand(overrides: Partial<OutboxCommand> = {}): OutboxCommand {
  return {
    id: 'cmd-uuid-1',
    type: OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION,
    payload: {
      stripeSubscriptionId: 'sub_123',
      newEndIso: '2026-03-01T00:00:00.000Z',
    },
    status: OutboxCommandStatus.PROCESSING,
    attempts: 0,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

describe('OutboxCommandProcessorService (unit)', () => {
  let service: OutboxCommandProcessorService;
  let outboxCommandRepositoryMock: Record<keyof OutboxCommandRepository, jest.Mock>;
  let stripeExtendSubscriptionExecutorMock: { execute: jest.Mock; type: OutboxCommandType };
  let loggerMock: { debug: jest.Mock; error: jest.Mock; warn: jest.Mock };

  beforeEach(async () => {
    loggerMock = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    outboxCommandRepositoryMock = {
      saveCommand: jest.fn(),
      lockCommandsForProcessing: jest.fn(),
      markAsProcessed: jest.fn(),
      markAsFailed: jest.fn(),
      recoverStaleCommands: jest.fn(),
    };

    stripeExtendSubscriptionExecutorMock = {
      type: OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION,
      execute: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxCommandProcessorService,
        { provide: OutboxCommandRepository, useValue: outboxCommandRepositoryMock },
        {
          provide: StripeExtendSubscriptionExecutor,
          useValue: stripeExtendSubscriptionExecutorMock,
        },
        {
          provide: LoggerFactory,
          useValue: { create: jest.fn().mockReturnValue(loggerMock) },
        },
      ],
    }).compile();

    service = module.get(OutboxCommandProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processOutboxCommands() — позитивные сценарии', () => {
    it('не вызывает executor, если заблокированный батч пуст', async () => {
      outboxCommandRepositoryMock.lockCommandsForProcessing.mockResolvedValue([]);

      await service.processOutboxCommands();

      expect(outboxCommandRepositoryMock.lockCommandsForProcessing).toHaveBeenCalledWith(
        OutboxCommandProcessing.LOCK_BATCH_SIZE,
      );
      expect(stripeExtendSubscriptionExecutorMock.execute).not.toHaveBeenCalled();
      expect(outboxCommandRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
    });

    it('выполняет STRIPE_EXTEND_SUBSCRIPTION и помечает команду PROCESSED', async () => {
      const command = createMockCommand({ id: 'cmd-uuid-ok' });
      outboxCommandRepositoryMock.lockCommandsForProcessing.mockResolvedValue([command]);
      outboxCommandRepositoryMock.markAsProcessed.mockResolvedValue(undefined);

      await service.processOutboxCommands();

      expect(stripeExtendSubscriptionExecutorMock.execute).toHaveBeenCalledTimes(1);
      expect(stripeExtendSubscriptionExecutorMock.execute).toHaveBeenCalledWith(command);
      expect(outboxCommandRepositoryMock.markAsProcessed).toHaveBeenCalledWith('cmd-uuid-ok');
      expect(outboxCommandRepositoryMock.markAsFailed).not.toHaveBeenCalled();
      expect(loggerMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('idempotencyKey=cmd-uuid-ok'),
        'processOutboxCommands',
      );
    });

    it('обрабатывает несколько команд по очереди', async () => {
      const first = createMockCommand({ id: 'cmd-1' });
      const second = createMockCommand({ id: 'cmd-2' });
      outboxCommandRepositoryMock.lockCommandsForProcessing.mockResolvedValue([first, second]);

      const stepLog: string[] = [];
      stripeExtendSubscriptionExecutorMock.execute.mockImplementation(async (cmd: OutboxCommand) => {
        stepLog.push(`execute:${cmd.id}`);
      });
      outboxCommandRepositoryMock.markAsProcessed.mockImplementation(async (id: string) => {
        stepLog.push(`mark:${id}`);
      });

      await service.processOutboxCommands();

      expect(stepLog).toEqual(['execute:cmd-1', 'mark:cmd-1', 'execute:cmd-2', 'mark:cmd-2']);
    });
  });

  describe('processOutboxCommands() — ошибки', () => {
    it('при ошибке executor вызывает markAsFailed и не помечает PROCESSED', async () => {
      const command = createMockCommand({ id: 'cmd-fail', attempts: 2 });
      outboxCommandRepositoryMock.lockCommandsForProcessing.mockResolvedValue([command]);
      stripeExtendSubscriptionExecutorMock.execute.mockRejectedValue(new Error('Stripe API error'));
      outboxCommandRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processOutboxCommands();

      expect(outboxCommandRepositoryMock.markAsProcessed).not.toHaveBeenCalled();
      expect(outboxCommandRepositoryMock.markAsFailed).toHaveBeenCalledWith(
        'cmd-fail',
        'Stripe API error',
        2,
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('attempts 3/10'),
        'processOutboxCommands',
      );
    });

    it('при падении одной команды из батча остальные обрабатываются', async () => {
      const first = createMockCommand({ id: 'cmd-1' });
      const second = createMockCommand({ id: 'cmd-2' });
      outboxCommandRepositoryMock.lockCommandsForProcessing.mockResolvedValue([first, second]);

      stripeExtendSubscriptionExecutorMock.execute
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Stripe timeout'));

      outboxCommandRepositoryMock.markAsProcessed.mockResolvedValue(undefined);
      outboxCommandRepositoryMock.markAsFailed.mockResolvedValue(undefined);

      await service.processOutboxCommands();

      expect(outboxCommandRepositoryMock.markAsProcessed).toHaveBeenCalledTimes(1);
      expect(outboxCommandRepositoryMock.markAsProcessed).toHaveBeenCalledWith('cmd-1');
      expect(outboxCommandRepositoryMock.markAsFailed).toHaveBeenCalledWith(
        'cmd-2',
        'Stripe timeout',
        0,
      );
    });
  });

  describe('processOutboxCommands() — защита isProcessing', () => {
    it('при параллельном вызове второй выходит сразу', async () => {
      let releaseLock!: (commands: OutboxCommand[]) => void;
      const lockPending = new Promise<OutboxCommand[]>((resolve) => {
        releaseLock = resolve;
      });
      outboxCommandRepositoryMock.lockCommandsForProcessing.mockReturnValue(lockPending);

      const firstRun = service.processOutboxCommands();
      const secondRun = service.processOutboxCommands();

      await secondRun;

      expect(outboxCommandRepositoryMock.lockCommandsForProcessing).toHaveBeenCalledTimes(1);

      releaseLock([]);
      await firstRun;

      expect(outboxCommandRepositoryMock.lockCommandsForProcessing).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleStaleCommands()', () => {
    it('при наличии зависших команд вызывает recoverStaleCommands и логирует warn', async () => {
      outboxCommandRepositoryMock.recoverStaleCommands.mockResolvedValue(4);

      await service.handleStaleCommands();

      expect(outboxCommandRepositoryMock.recoverStaleCommands).toHaveBeenCalledWith(
        OutboxCommandProcessing.STALE_THRESHOLD_MINUTES,
      );
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('4'),
        'handleStaleCommands',
      );
    });
  });
});
