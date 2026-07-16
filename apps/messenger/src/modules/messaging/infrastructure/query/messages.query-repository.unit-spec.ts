import { Test, TestingModule } from '@nestjs/testing';
import { Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { MessagesQueryRepository } from './messages.query-repository';

describe('MessagesQueryRepository (unit)', () => {
  let repository: MessagesQueryRepository;
  let prismaMock: {
    message: { findMany: jest.Mock };
    chatReadState: { findUnique: jest.Mock };
    messageDelivery: { findMany: jest.Mock };
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
    senderId: 2,
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
      message: {
        findMany: jest.fn().mockResolvedValue([messageA, messageB, messageC]),
      },
      chatReadState: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      messageDelivery: {
        findMany: jest.fn().mockResolvedValue([]),
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
      }),
    );
    expect(result).toEqual({
      items: [
        {
          id: '3',
          chatId: '10',
          senderId: '1',
          receiverId: '2',
          text: 'Third',
          clientMessageId,
          createdAt: sameCreatedAt.toISOString(),
          status: 'sent',
          editedAt: null,
          deletedAt: null,
          deletedForEveryone: false,
          replyTo: null,
        },
        {
          id: '2',
          chatId: '10',
          senderId: '2',
          receiverId: '1',
          text: 'Second',
          clientMessageId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
          createdAt: sameCreatedAt.toISOString(),
          status: null,
          editedAt: null,
          deletedAt: null,
          deletedForEveryone: false,
          replyTo: null,
        },
      ],
      hasMore: true,
      nextCursor: encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) }),
    });
  });

  it('findChatMessages: вычисляет status delivered/read для своих сообщений', async () => {
    prismaMock.message.findMany.mockResolvedValue([messageA]);
    prismaMock.chatReadState.findUnique.mockResolvedValue({ lastReadMessageId: 3 });
    prismaMock.messageDelivery.findMany.mockResolvedValue([{ messageId: 3 }]);

    const result = await repository.findChatMessages(10, 1, 2, { limit: 1 });

    expect(result.items[0].status).toBe('read');
    expect(prismaMock.messageDelivery.findMany).toHaveBeenCalledWith({
      where: {
        messageId: { in: [3] },
        userId: 2,
      },
      select: { messageId: true },
    });
  });

  it('findChatMessages: маскирует текст tombstone и подтягивает replyTo', async () => {
    const deletedMessage: Message = {
      ...messageB,
      text: 'secret',
      deletedForEveryone: true,
      deletedAt: sameCreatedAt,
      replyToMessageId: 1,
    };
    prismaMock.message.findMany
      .mockResolvedValueOnce([deletedMessage])
      .mockResolvedValueOnce([
        {
          id: 1,
          senderId: 2,
          text: 'First',
          deletedForEveryone: false,
        },
      ]);

    const result = await repository.findChatMessages(10, 1, 2, { limit: 1 });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        text: '',
        deletedForEveryone: true,
        deletedAt: sameCreatedAt.toISOString(),
        replyTo: {
          id: '1',
          senderId: '2',
          text: 'First',
          deletedForEveryone: false,
        },
      }),
    );
  });

  it('findChatMessages: при cursor применяет keyset-фильтр', async () => {
    const cursor = encodeCursor({ createdAt: sameCreatedAt, id: String(messageB.id) });
    prismaMock.message.findMany.mockResolvedValue([messageC]);

    const result = await repository.findChatMessages(10, 1, 2, { cursor, limit: 2 });

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
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
