import { Test, TestingModule } from '@nestjs/testing';
import { OutboxEventStatus, OutboxEventType } from '@generated/prisma-messenger';
import { PrismaService } from '../../database/prisma.service';
import { OutboxProcessing } from '../constants/outbox.constants';
import { OutboxRepository } from './outbox.repository';

function extractQueryRawSql(mock: jest.Mock): string {
  const [first] = mock.mock.calls[0] as [unknown];

  if (Array.isArray(first)) {
    return first.join(' ');
  }

  if (first && typeof first === 'object') {
    const sql = first as { strings?: string[]; text?: string };

    if (typeof sql.text === 'string') {
      return sql.text;
    }

    if (Array.isArray(sql.strings)) {
      return sql.strings.join(' ');
    }
  }

  return String(first);
}

describe('OutboxRepository (unit)', () => {
  let repository: OutboxRepository;
  let prismaMock: {
    $queryRaw: jest.Mock;
    outboxEvent: {
      create: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      outboxEvent: {
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboxRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(OutboxRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('saveEvent: сохраняет PENDING-событие с availableAt', async () => {
    const availableAt = new Date('2026-08-22T12:00:20.000Z');
    const payload = { chatId: 10, messageId: 100, senderId: 1, recipientId: 2 };
    prismaMock.outboxEvent.create.mockResolvedValue({ id: 'event-1' });

    await repository.saveEvent(OutboxEventType.NEW_MESSAGE_NOTIFICATION, payload, availableAt);

    expect(prismaMock.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxEventType.NEW_MESSAGE_NOTIFICATION,
        payload,
        status: OutboxEventStatus.PENDING,
        availableAt,
      },
    });
  });

  it('lockEventsForProcessing: выбирает только PENDING с наступившим availableAt', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await repository.lockEventsForProcessing(OutboxEventType.NEW_MESSAGE_NOTIFICATION, 10);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);

    const sql = extractQueryRawSql(prismaMock.$queryRaw);
    expect(sql).toContain('available_at');
    expect(sql).toContain('<= NOW()');

    const values = prismaMock.$queryRaw.mock.calls[0].slice(1);
    expect(values).toEqual(
      expect.arrayContaining([
        OutboxEventStatus.PROCESSING,
        OutboxEventStatus.PENDING,
        OutboxEventType.NEW_MESSAGE_NOTIFICATION,
        10,
      ]),
    );
  });

  it('lockEventsForProcessing: использует LOCK_BATCH_SIZE по умолчанию', async () => {
    await repository.lockEventsForProcessing(OutboxEventType.NEW_MESSAGE_NOTIFICATION);

    const values = prismaMock.$queryRaw.mock.calls[0].slice(1);
    expect(values).toContain(OutboxProcessing.LOCK_BATCH_SIZE);
  });

  it('markAsSkipped: пишет SKIPPED и причину в error', async () => {
    prismaMock.outboxEvent.update.mockResolvedValue({});

    await repository.markAsSkipped('event-1', 'chat_muted');

    expect(prismaMock.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: OutboxEventStatus.SKIPPED, error: 'chat_muted' },
    });
  });
});
