import { Test, TestingModule } from '@nestjs/testing';
import { Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { MessagesQueryRepository } from './messages.query-repository';

describe('MessagesQueryRepository (unit)', () => {
  let repository: MessagesQueryRepository;
  let prismaMock: {
    message: { findMany: jest.Mock };
  };

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
    senderId: 2,
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
        findMany: jest.fn().mockResolvedValue([messageA, messageB, messageC]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesQueryRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(MessagesQueryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findChatMessages: маппит сообщения в MessageViewDto и receiverId', async () => {
    const result = await repository.findChatMessages(10, 1, 2, { limit: 2 });

    expect(result).toEqual({
      items: [
        {
          id: '3',
          chatId: '10',
          senderId: '1',
          receiverId: '2',
          text: 'Third',
          createdAt: sameCreatedAt.toISOString(),
        },
        {
          id: '2',
          chatId: '10',
          senderId: '2',
          receiverId: '1',
          text: 'Second',
          createdAt: sameCreatedAt.toISOString(),
        },
      ],
      hasMore: true,
      nextCursor: encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) }),
    });
  });

  it('findChatMessages: при cursor применяет keyset-фильтр', async () => {
    const cursor = encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) });
    prismaMock.message.findMany.mockResolvedValue([messageC]);

    const result = await repository.findChatMessages(10, 1, 2, { cursor, limit: 2 });

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
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
