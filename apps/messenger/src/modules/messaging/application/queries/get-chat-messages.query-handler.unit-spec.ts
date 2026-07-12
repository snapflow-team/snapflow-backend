import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { ForbiddenException } from '../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { GetChatMessagesQuery, GetChatMessagesQueryHandler } from './get-chat-messages.query-handler';

describe('GetChatMessagesQueryHandler (unit)', () => {
  let handler: GetChatMessagesQueryHandler;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'findById' | 'getInterlocutorId'>>;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'findByChatIdPaginated'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');

  const chat: Chat = {
    id: 10,
    participantAId: 1,
    participantBId: 2,
    lastMessageId: null,
    lastMessageAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  const message: Message = {
    id: 100,
    chatId: 10,
    senderId: 1,
    text: 'Hello!',
    createdAt,
  };

  beforeEach(async () => {
    chatsRepositoryMock = {
      findById: jest.fn().mockResolvedValue(chat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
    };

    messagesRepositoryMock = {
      findByChatIdPaginated: jest.fn().mockResolvedValue({
        items: [message],
        hasMore: false,
        nextCursor: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetChatMessagesQueryHandler,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
      ],
    }).compile();

    handler = module.get(GetChatMessagesQueryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен вернуть cursor-страницу сообщений с корректным receiverId', async () => {
    const result = await handler.execute(
      new GetChatMessagesQuery(10, 1, { limit: 8 }),
    );

    expect(chatsRepositoryMock.findById).toHaveBeenCalledWith(10);
    expect(messagesRepositoryMock.findByChatIdPaginated).toHaveBeenCalledWith(10, {
      cursor: undefined,
      limit: 8,
    });
    expect(result).toEqual({
      items: [
        {
          id: '100',
          chatId: '10',
          senderId: '1',
          receiverId: '2',
          text: 'Hello!',
          createdAt: createdAt.toISOString(),
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('должен запретить доступ, если чат не найден', async () => {
    chatsRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetChatMessagesQuery(10, 1, { limit: 8 })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(messagesRepositoryMock.findByChatIdPaginated).not.toHaveBeenCalled();
  });
});
