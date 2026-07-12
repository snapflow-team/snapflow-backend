import { Test, TestingModule } from '@nestjs/testing';
import { Chat } from '@generated/prisma-messenger';
import { encodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../database/prisma.service';
import { ChatsRepository } from './chats.repository';
import { ChatListRow } from './types/chat-list-row.type';

describe('ChatsRepository (unit)', () => {
  let repository: ChatsRepository;
  let prismaMock: { $queryRaw: jest.Mock; chat: { findUnique: jest.Mock; upsert: jest.Mock } };

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const lastMessageAt = new Date('2026-07-06T12:00:00.000Z');

  const rowWithMessage: ChatListRow = {
    id: 2,
    participant_a_id: 1,
    participant_b_id: 3,
    last_message_id: 20,
    last_message_at: lastMessageAt,
    created_at: createdAt,
    updated_at: lastMessageAt,
    lm_id: 20,
    lm_chat_id: 2,
    lm_sender_id: 3,
    lm_text: 'Hi',
    lm_created_at: lastMessageAt,
    unread_count: 1,
  };

  const rowWithoutMessage: ChatListRow = {
    id: 1,
    participant_a_id: 1,
    participant_b_id: 2,
    last_message_id: null,
    last_message_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    lm_id: null,
    lm_chat_id: null,
    lm_sender_id: null,
    lm_text: null,
    lm_created_at: null,
    unread_count: 0,
  };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn(),
      chat: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatsRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(ChatsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findUserChatsPaginated: маппит чаты, собеседника, lastMessage и unreadCount', async () => {
    prismaMock.$queryRaw.mockResolvedValue([rowWithMessage, rowWithoutMessage]);

    const result = await repository.findUserChatsPaginated(1, { limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      chat: {
        id: 2,
        participantAId: 1,
        participantBId: 3,
        lastMessageId: 20,
        lastMessageAt,
        createdAt,
        updatedAt: lastMessageAt,
      },
      interlocutorId: 3,
      lastMessage: {
        id: 20,
        chatId: 2,
        senderId: 3,
        text: 'Hi',
        createdAt: lastMessageAt,
      },
      unreadCount: 1,
    });
    expect(result.items[1]).toEqual({
      chat: {
        id: 1,
        participantAId: 1,
        participantBId: 2,
        lastMessageId: null,
        lastMessageAt: null,
        createdAt,
        updatedAt: createdAt,
      },
      interlocutorId: 2,
      lastMessage: null,
      unreadCount: 0,
    });
  });

  it('findUserChatsPaginated: nextCursor строится по COALESCE(lastMessageAt, createdAt)', async () => {
    prismaMock.$queryRaw.mockResolvedValue([rowWithMessage, rowWithoutMessage, rowWithoutMessage]);

    const result = await repository.findUserChatsPaginated(1, { limit: 2 });

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(encodeCursor({ createdAt, id: String(rowWithoutMessage.id) }));
  });

  it('findUserChatsPaginated: при cursor запрашивает следующую страницу', async () => {
    const cursor = encodeCursor({ createdAt: lastMessageAt, id: String(rowWithMessage.id) });
    prismaMock.$queryRaw.mockResolvedValue([rowWithoutMessage]);

    const result = await repository.findUserChatsPaginated(1, { cursor, limit: 2 });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].chat.id).toBe(rowWithoutMessage.id);
  });

  it('getOrCreate: нормализует участников и вызывает upsert', async () => {
    const chat: Chat = {
      id: 5,
      participantAId: 2,
      participantBId: 7,
      lastMessageId: null,
      lastMessageAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    prismaMock.chat.upsert.mockResolvedValue(chat);

    await expect(repository.getOrCreate(7, 2)).resolves.toEqual(chat);
    expect(prismaMock.chat.upsert).toHaveBeenCalledWith({
      where: {
        participantAId_participantBId: {
          participantAId: 2,
          participantBId: 7,
        },
      },
      create: {
        participantAId: 2,
        participantBId: 7,
      },
      update: {},
    });
  });

  it('getInterlocutorId: возвращает второго участника чата', () => {
    const chat: Pick<Chat, 'participantAId' | 'participantBId'> = {
      participantAId: 1,
      participantBId: 5,
    };

    expect(repository.getInterlocutorId(chat, 1)).toBe(5);
    expect(repository.getInterlocutorId(chat, 5)).toBe(1);
  });

  it('findById: возвращает чат по id', async () => {
    const chat: Chat = {
      id: 7,
      participantAId: 1,
      participantBId: 2,
      lastMessageId: null,
      lastMessageAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    prismaMock.chat.findUnique.mockResolvedValue(chat);

    await expect(repository.findById(7)).resolves.toEqual(chat);
    expect(prismaMock.chat.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});
