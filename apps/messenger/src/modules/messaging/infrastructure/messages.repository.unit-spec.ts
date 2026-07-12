import { Test, TestingModule } from '@nestjs/testing';
import { Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../database/prisma.service';
import { MessagesRepository } from './messages.repository';

describe('MessagesRepository (unit)', () => {
  let repository: MessagesRepository;
  let prismaMock: { message: { findMany: jest.Mock } };

  const sameCreatedAt = new Date('2026-07-05T18:00:00.000Z');

  const messageA: Message = {
    id: 3,
    chatId: 10,
    senderId: 1,
    text: 'Third',
    createdAt: sameCreatedAt,
  };

  const messageB: Message = {
    id: 2,
    chatId: 10,
    senderId: 1,
    text: 'Second',
    createdAt: sameCreatedAt,
  };

  const messageC: Message = {
    id: 1,
    chatId: 10,
    senderId: 2,
    text: 'First',
    createdAt: sameCreatedAt,
  };

  beforeEach(async () => {
    prismaMock = {
      message: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(MessagesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('первая страница: возвращает limit элементов и nextCursor при hasMore', async () => {
    prismaMock.message.findMany.mockResolvedValue([messageA, messageB, messageC]);

    const result = await repository.findByChatIdPaginated(10, { limit: 2 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toEqual([messageA, messageB]);
    expect(result.nextCursor).toBe(
      encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) }),
    );
    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chatId: 10 },
        take: 3,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('следующая страница: применяет keyset-фильтр по (createdAt, id) с tie-breaker', async () => {
    const cursor = encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) });
    prismaMock.message.findMany.mockResolvedValue([messageC]);

    const result = await repository.findByChatIdPaginated(10, { cursor, limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toEqual([messageC]);
    expect(result.nextCursor).toBeNull();
    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId: 10,
          OR: [
            { createdAt: { lt: sameCreatedAt } },
            { createdAt: sameCreatedAt, id: { lt: messageB.id } },
          ],
        },
      }),
    );
  });
});
