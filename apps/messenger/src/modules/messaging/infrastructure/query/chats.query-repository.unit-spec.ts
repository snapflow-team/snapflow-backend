import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { ChatsQueryRepository } from './chats.query-repository';
import { ChatListRow } from '../types/chat-list-row.type';

describe('ChatsQueryRepository (unit)', () => {
  let repository: ChatsQueryRepository;
  let prismaMock: { $queryRaw: jest.Mock; chat: { findUnique: jest.Mock } };

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const lastMessageAt = new Date('2026-07-06T12:00:00.000Z');

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
    unreadCount: 0,
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      chat: {
        findUnique: jest.fn(),
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
        createdAt: lastMessageAt.toISOString(),
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
    const chat: Chat & { lastMessage: Message | null } = {
      id: 10,
      participantAId: 1,
      participantBId: 2,
      lastMessageId: 100,
      lastMessageAt,
      createdAt,
      updatedAt: lastMessageAt,
      lastMessage: {
        id: 100,
        chatId: 10,
        senderId: 2,
        text: 'Hi',
        createdAt: lastMessageAt,
      },
    };
    prismaMock.chat.findUnique.mockResolvedValue(chat);

    const result = await repository.findChatById(10, 1);

    expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      include: { lastMessage: true },
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
        createdAt: lastMessageAt.toISOString(),
      },
      createdAt: createdAt.toISOString(),
      updatedAt: lastMessageAt.toISOString(),
    });
  });

  it('findChatViewById: возвращает null, если чат не найден', async () => {
    prismaMock.chat.findUnique.mockResolvedValue(null);

    await expect(repository.findChatById(999, 1)).resolves.toBeNull();
  });
});
