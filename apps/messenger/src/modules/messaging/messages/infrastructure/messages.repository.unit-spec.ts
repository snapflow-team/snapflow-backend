import { Test, TestingModule } from '@nestjs/testing';
import { Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { MessagesRepository } from './messages.repository';

describe('MessagesRepository (unit)', () => {
  let repository: MessagesRepository;
  let prismaMock: {
    $queryRaw: jest.Mock;
    message: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  const sameCreatedAt = new Date('2026-07-05T18:00:00.000Z');

  const clientMessageId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  const messageA: Message = {
    id: 3,
    chatId: 10,
    senderId: 1,
    text: 'Third',
    clientMessageId,
    createdAt: sameCreatedAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  const messageB: Message = {
    id: 2,
    chatId: 10,
    senderId: 1,
    text: 'Second',
    clientMessageId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    createdAt: sameCreatedAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  const messageC: Message = {
    id: 1,
    chatId: 10,
    senderId: 2,
    text: 'First',
    clientMessageId: '5fa85f64-5717-4562-b3fc-2c963f66afa6',
    createdAt: sameCreatedAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
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

  it('createOrGetExisting: возвращает новое сообщение с isNew=true', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ ...messageA, isNew: true }]);

    const result = await repository.createOrGetExisting({
      chatId: 10,
      senderId: 1,
      text: 'Third',
      clientMessageId,
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: messageA, isNew: true });
  });

  it('createOrGetExisting: возвращает существующее сообщение с isNew=false', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ ...messageA, isNew: false }]);

    const result = await repository.createOrGetExisting({
      chatId: 10,
      senderId: 1,
      text: 'Third',
      clientMessageId,
    });

    expect(result).toEqual({ message: messageA, isNew: false });
  });

  it('createOrGetExisting: использует переданный tx', async () => {
    const txMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ ...messageA, isNew: true }]),
    };

    const result = await repository.createOrGetExisting(
      {
        chatId: 10,
        senderId: 1,
        text: 'Third',
        clientMessageId,
      },
      txMock as never,
    );

    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(result).toEqual({ message: messageA, isNew: true });
  });

  it('первая страница: возвращает limit элементов и nextCursor при hasMore', async () => {
    prismaMock.message.findMany.mockResolvedValue([messageA, messageB, messageC]);

    const result = await repository.findByChatIdPaginated(10, { limit: 2, viewerUserId: 1 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toEqual([messageA, messageB]);
    expect(result.nextCursor).toBe(
      encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) }),
    );
    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId: 10,
          NOT: {
            userDeletions: {
              some: { userId: 1 },
            },
          },
        },
        take: 3,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('следующая страница: применяет keyset-фильтр по (createdAt, id) с tie-breaker', async () => {
    const cursor = encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) });
    prismaMock.message.findMany.mockResolvedValue([messageC]);

    const result = await repository.findByChatIdPaginated(10, {
      cursor,
      limit: 2,
      viewerUserId: 1,
    });

    expect(result.hasMore).toBe(false);
    expect(result.items).toEqual([messageC]);
    expect(result.nextCursor).toBeNull();
    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          chatId: 10,
          NOT: {
            userDeletions: {
              some: { userId: 1 },
            },
          },
          OR: [
            { createdAt: { lt: sameCreatedAt } },
            { createdAt: sameCreatedAt, id: { lt: messageB.id } },
          ],
        },
      }),
    );
  });
});
