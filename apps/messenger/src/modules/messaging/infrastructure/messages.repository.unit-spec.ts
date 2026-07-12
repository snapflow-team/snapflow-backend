import { Test, TestingModule } from '@nestjs/testing';
import { Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../database/prisma.service';
import { MessagesRepository } from './messages.repository';

describe('MessagesRepository (unit)', () => {
  let repository: MessagesRepository;
  let prismaMock: {
    $transaction: jest.Mock;
    message: { create: jest.Mock; findMany: jest.Mock };
    chat: { update: jest.Mock };
  };
  let txMock: { message: { create: jest.Mock }; chat: { update: jest.Mock } };

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
    txMock = {
      message: {
        create: jest.fn(),
      },
      chat: {
        update: jest.fn(),
      },
    };

    prismaMock = {
      $transaction: jest.fn(async (callback: (tx: typeof txMock) => Promise<Message>) =>
        callback(txMock),
      ),
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      chat: {
        update: jest.fn(),
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

  it('create: сохраняет сообщение и обновляет lastMessage* чата в одной транзакции', async () => {
    txMock.message.create.mockResolvedValue(messageA);
    txMock.chat.update.mockResolvedValue({});

    const result = await repository.create({
      chatId: 10,
      senderId: 1,
      text: 'Third',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.message.create).toHaveBeenCalledWith({
      data: {
        chatId: 10,
        senderId: 1,
        text: 'Third',
      },
    });
    expect(txMock.chat.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        lastMessageId: messageA.id,
        lastMessageAt: messageA.createdAt,
      },
    });
    expect(result).toEqual(messageA);
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
