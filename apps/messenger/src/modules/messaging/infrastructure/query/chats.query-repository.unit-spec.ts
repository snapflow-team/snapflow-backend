import { Test, TestingModule } from '@nestjs/testing';
import { encodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { ChatsQueryRepository } from './chats.query-repository';
import { ChatListRow } from '../types/chat-list-row.type';

describe('ChatsQueryRepository (unit)', () => {
  let repository: ChatsQueryRepository;
  let prismaMock: { $queryRaw: jest.Mock };

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
});
