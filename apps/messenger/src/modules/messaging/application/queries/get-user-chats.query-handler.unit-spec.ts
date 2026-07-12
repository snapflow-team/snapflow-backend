import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { GetUserChatsQuery, GetUserChatsQueryHandler } from './get-user-chats.query-handler';

describe('GetUserChatsQueryHandler (unit)', () => {
  let handler: GetUserChatsQueryHandler;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'findUserChatsPaginated'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const lastMessageAt = new Date('2026-07-06T12:00:00.000Z');

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
    createdAt: lastMessageAt,
  };

  beforeEach(async () => {
    chatsRepositoryMock = {
      findUserChatsPaginated: jest.fn().mockResolvedValue({
        items: [
          {
            chat,
            interlocutorId: 2,
            lastMessage,
            unreadCount: 1,
          },
        ],
        hasMore: false,
        nextCursor: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserChatsQueryHandler,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
      ],
    }).compile();

    handler = module.get(GetUserChatsQueryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен вернуть cursor-страницу чатов с маппингом в ChatListItemViewDto', async () => {
    const result = await handler.execute(
      new GetUserChatsQuery(1, { limit: 8 }),
    );

    expect(chatsRepositoryMock.findUserChatsPaginated).toHaveBeenCalledWith(1, {
      cursor: undefined,
      limit: 8,
    });
    expect(result).toEqual({
      items: [
        {
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
          unreadCount: 1,
          createdAt: createdAt.toISOString(),
          updatedAt: lastMessageAt.toISOString(),
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
  });
});
