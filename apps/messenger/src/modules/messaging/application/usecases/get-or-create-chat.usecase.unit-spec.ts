import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { GetOrCreateChatCommand, GetOrCreateChatUseCase } from './get-or-create-chat.usecase';

describe('GetOrCreateChatUseCase (unit)', () => {
  let useCase: GetOrCreateChatUseCase;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'getOrCreate' | 'getInterlocutorId'>>;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'findById'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const lastMessageAt = new Date('2026-07-06T12:00:00.000Z');

  const emptyChat: Chat = {
    id: 10,
    participantAId: 1,
    participantBId: 2,
    lastMessageId: null,
    lastMessageAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  const chatWithMessage: Chat = {
    ...emptyChat,
    lastMessageId: 100,
    lastMessageAt,
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
      getOrCreate: jest.fn().mockResolvedValue(emptyChat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
    };

    messagesRepositoryMock = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOrCreateChatUseCase,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
      ],
    }).compile();

    useCase = module.get(GetOrCreateChatUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен get-or-create чат без lastMessage для пустого чата', async () => {
    const result = await useCase.execute(
      new GetOrCreateChatCommand({ userId: 1, interlocutorId: 2 }),
    );

    expect(chatsRepositoryMock.getOrCreate).toHaveBeenCalledWith(1, 2);
    expect(messagesRepositoryMock.findById).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: '10',
      interlocutorId: '2',
      lastMessage: null,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });
  });

  it('должен вернуть lastMessage для существующего чата с сообщениями', async () => {
    chatsRepositoryMock.getOrCreate.mockResolvedValue(chatWithMessage);
    messagesRepositoryMock.findById.mockResolvedValue(lastMessage);

    const result = await useCase.execute(
      new GetOrCreateChatCommand({ userId: 1, interlocutorId: 2 }),
    );

    expect(messagesRepositoryMock.findById).toHaveBeenCalledWith(100);
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

  it('должен запретить создание чата с самим собой', async () => {
    await expect(
      useCase.execute(new GetOrCreateChatCommand({ userId: 5, interlocutorId: 5 })),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(chatsRepositoryMock.getOrCreate).not.toHaveBeenCalled();
    expect(messagesRepositoryMock.findById).not.toHaveBeenCalled();
  });
});
