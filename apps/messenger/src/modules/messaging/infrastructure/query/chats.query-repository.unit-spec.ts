import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { ChatsQueryRepository } from './chats.query-repository';
import { ChatListRow } from '../types/chat-list-row.type';

describe('ChatsQueryRepository (unit)', () => {
  let repository: ChatsQueryRepository;
  let prismaMock: {
    $queryRaw: jest.Mock;
    chat: { findUnique: jest.Mock; findMany: jest.Mock };
    message: { findFirst: jest.Mock };
  };

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const lastMessageAt = new Date('2026-07-06T12:00:00.000Z');

  const messageClientMessageId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  const rowWithMessage: ChatListRow = {
    id: 2,
    participantAId: 1,
    participantBId: 3,
    chatLastMessageId: 20,
    chatLastMessageAt: lastMessageAt,
    chatCreatedAt: createdAt,
    chatUpdatedAt: lastMessageAt,
    messageId: 20,
    messageChatId: 2,
    messageSenderId: 3,
    messageText: 'Hi',
    messageCreatedAt: lastMessageAt,
    messageClientMessageId,
    messageEditedAt: null,
    messageDeletedAt: null,
    messageDeletedForEveryone: false,
    messageReplyToMessageId: null,
    peerLastReadMessageId: null,
    messageDeliveredToPeer: false,
    unreadCount: 1,
  };

  const rowWithoutMessage: ChatListRow = {
    id: 1,
    participantAId: 1,
    participantBId: 2,
    chatLastMessageId: null,
    chatLastMessageAt: null,
    chatCreatedAt: createdAt,
    chatUpdatedAt: createdAt,
    messageId: null,
    messageChatId: null,
    messageSenderId: null,
    messageText: null,
    messageCreatedAt: null,
    messageClientMessageId: null,
    messageEditedAt: null,
    messageDeletedAt: null,
    messageDeletedForEveryone: null,
    messageReplyToMessageId: null,
    peerLastReadMessageId: null,
    messageDeliveredToPeer: null,
    unreadCount: 0,
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      chat: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      message: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatsQueryRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(ChatsQueryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findUserChats: маппит чаты, собеседника, lastMessage и unreadCount в ChatListItemViewDto', async () => {
    prismaMock.$queryRaw.mockResolvedValue([rowWithMessage, rowWithoutMessage]);

    const result = await repository.findUserChats(1, { limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      id: '2',
      interlocutorId: '3',
      lastMessage: {
        id: '20',
        chatId: '2',
        senderId: '3',
        receiverId: '1',
        text: 'Hi',
        clientMessageId: messageClientMessageId,
        createdAt: lastMessageAt.toISOString(),
        status: null,
        editedAt: null,
        deletedAt: null,
        deletedForEveryone: false,
        replyTo: null,
      },
      unreadCount: 1,
      createdAt: createdAt.toISOString(),
      updatedAt: lastMessageAt.toISOString(),
    });
    expect(result.items[1]).toEqual({
      id: '1',
      interlocutorId: '2',
      lastMessage: null,
      unreadCount: 0,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });
  });

  it('findUserChats: nextCursor строится по COALESCE(lastMessageAt, createdAt)', async () => {
    prismaMock.$queryRaw.mockResolvedValue([rowWithMessage, rowWithoutMessage, rowWithoutMessage]);

    const result = await repository.findUserChats(1, { limit: 2 });

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(encodeCursor({ createdAt, id: String(rowWithoutMessage.id) }));
  });

  it('findUserChats: при cursor запрашивает следующую страницу', async () => {
    const cursor = encodeCursor({ createdAt: lastMessageAt, id: String(rowWithMessage.id) });
    prismaMock.$queryRaw.mockResolvedValue([rowWithoutMessage]);

    const result = await repository.findUserChats(1, { cursor, limit: 2 });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(String(rowWithoutMessage.id));
  });

  it('findChatViewById: возвращает ChatViewDto c lastMessage', async () => {
    const chat: Chat = {
      id: 10,
      participantAId: 1,
      participantBId: 2,
      lastMessageId: 100,
      lastMessageAt,
      createdAt,
      updatedAt: lastMessageAt,
    };
    const lastMessage: Message = {
      id: 100,
      chatId: 10,
      senderId: 2,
      text: 'Hi',
      clientMessageId: messageClientMessageId,
      createdAt: lastMessageAt,
      editedAt: null,
      deletedAt: null,
      deletedForEveryone: false,
      replyToMessageId: null,
    };
    prismaMock.chat.findUnique.mockResolvedValue(chat);
    prismaMock.message.findFirst.mockResolvedValue(lastMessage);

    const result = await repository.findChatById(10, 1);

    expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
    });
    expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
      where: {
        chatId: 10,
        NOT: {
          userDeletions: {
            some: { userId: 1 },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(result).toEqual({
      id: '10',
      interlocutorId: '2',
      lastMessage: {
        id: '100',
        chatId: '10',
        senderId: '2',
        receiverId: '1',
        text: 'Hi',
        clientMessageId: messageClientMessageId,
        createdAt: lastMessageAt.toISOString(),
        status: null,
        editedAt: null,
        deletedAt: null,
        deletedForEveryone: false,
        replyTo: null,
      },
      createdAt: createdAt.toISOString(),
      updatedAt: lastMessageAt.toISOString(),
    });
  });

  it('findChatViewById: возвращает null lastMessage, если все сообщения скрыты viewer’ом', async () => {
    const chat: Chat = {
      id: 10,
      participantAId: 1,
      participantBId: 2,
      lastMessageId: 100,
      lastMessageAt,
      createdAt,
      updatedAt: lastMessageAt,
    };
    prismaMock.chat.findUnique.mockResolvedValue(chat);
    prismaMock.message.findFirst.mockResolvedValue(null);

    const result = await repository.findChatById(10, 1);

    expect(result).toEqual({
      id: '10',
      interlocutorId: '2',
      lastMessage: null,
      createdAt: createdAt.toISOString(),
      updatedAt: lastMessageAt.toISOString(),
    });
  });

  it('findChatViewById: возвращает null, если чат не найден', async () => {
    prismaMock.chat.findUnique.mockResolvedValue(null);

    await expect(repository.findChatById(999, 1)).resolves.toBeNull();
  });

  it('getUnreadCount: возвращает число непрочитанных сообщений', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ unreadCount: 4 }]);

    await expect(repository.getUnreadCount(10, 1)).resolves.toBe(4);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('getUnreadCount: возвращает 0, если строк нет', async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(repository.getUnreadCount(10, 1)).resolves.toBe(0);
  });

  it('findPeerUserIds: возвращает distinct собеседников по всем чатам', async () => {
    prismaMock.chat.findMany.mockResolvedValue([
      { participantAId: 1, participantBId: 2 },
      { participantAId: 3, participantBId: 1 },
      { participantAId: 1, participantBId: 2 },
    ]);

    await expect(repository.findPeerUserIds(1)).resolves.toEqual([2, 3]);
    expect(prismaMock.chat.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ participantAId: 1 }, { participantBId: 1 }],
      },
      select: {
        participantAId: true,
        participantBId: true,
      },
    });
  });
});
