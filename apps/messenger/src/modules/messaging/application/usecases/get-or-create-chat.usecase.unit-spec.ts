import { Test, TestingModule } from '@nestjs/testing';
import { Chat } from '@generated/prisma-messenger';
import {
  BadRequestException,
  InternalServerException,
} from '../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { GetOrCreateChatCommand, GetOrCreateChatUseCase } from './get-or-create-chat.usecase';

describe('GetOrCreateChatUseCase (unit)', () => {
  let useCase: GetOrCreateChatUseCase;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'getOrCreate'>>;
  let chatsQueryRepositoryMock: jest.Mocked<Pick<ChatsQueryRepository, 'findChatById'>>;

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

  const emptyChatView = {
    id: '10',
    interlocutorId: '2',
    lastMessage: null,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
  };

  const chatViewWithLastMessage = {
    id: '10',
    interlocutorId: '2',
    lastMessage: {
      id: '100',
      chatId: '10',
      senderId: '2',
      receiverId: '1',
      text: 'Hi',
      clientMessageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      createdAt: lastMessageAt.toISOString(),
    },
    createdAt: createdAt.toISOString(),
    updatedAt: lastMessageAt.toISOString(),
  };

  beforeEach(async () => {
    chatsRepositoryMock = {
      getOrCreate: jest.fn().mockResolvedValue(emptyChat),
    };

    chatsQueryRepositoryMock = {
      findChatById: jest.fn().mockResolvedValue(emptyChatView),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOrCreateChatUseCase,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: ChatsQueryRepository, useValue: chatsQueryRepositoryMock },
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
    expect(chatsQueryRepositoryMock.findChatById).toHaveBeenCalledWith(10, 1);
    expect(result).toEqual(emptyChatView);
  });

  it('должен вернуть lastMessage для существующего чата с сообщениями', async () => {
    chatsRepositoryMock.getOrCreate.mockResolvedValue(chatWithMessage);
    chatsQueryRepositoryMock.findChatById.mockResolvedValue(chatViewWithLastMessage);

    const result = await useCase.execute(
      new GetOrCreateChatCommand({ userId: 1, interlocutorId: 2 }),
    );

    expect(chatsQueryRepositoryMock.findChatById).toHaveBeenCalledWith(10, 1);
    expect(result).toEqual(chatViewWithLastMessage);
  });

  it('должен бросить ошибку, если query-repository не вернул view', async () => {
    chatsQueryRepositoryMock.findChatById.mockResolvedValue(null);

    await expect(
      useCase.execute(new GetOrCreateChatCommand({ userId: 1, interlocutorId: 2 })),
    ).rejects.toBeInstanceOf(InternalServerException);
  });

  it('должен запретить создание чата с самим собой', async () => {
    await expect(
      useCase.execute(new GetOrCreateChatCommand({ userId: 5, interlocutorId: 5 })),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(chatsRepositoryMock.getOrCreate).not.toHaveBeenCalled();
    expect(chatsQueryRepositoryMock.findChatById).not.toHaveBeenCalled();
  });
});
