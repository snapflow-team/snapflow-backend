import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';
import { SendMessageCommand, SendMessageUseCase } from './send-message.usecase';

describe('SendMessageUseCase (unit)', () => {
  let useCase: SendMessageUseCase;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'getOrCreate'>>;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'create'>>;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'sendToUser'>>;

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
      getOrCreate: jest.fn().mockResolvedValue(chat),
    };

    messagesRepositoryMock = {
      create: jest.fn().mockResolvedValue(message),
    };

    messengerWebSocketServiceMock = {
      sendToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendMessageUseCase,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(SendMessageUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен get-or-create чат, сохранить сообщение и отправить его получателю по WS', async () => {
    const result = await useCase.execute(
      new SendMessageCommand({
        senderId: 1,
        receiverId: 2,
        text: 'Hello!',
      }),
    );

    expect(chatsRepositoryMock.getOrCreate).toHaveBeenCalledWith(1, 2);
    expect(messagesRepositoryMock.create).toHaveBeenCalledWith({
      chatId: 10,
      senderId: 1,
      text: 'Hello!',
    });
    expect(messengerWebSocketServiceMock.sendToUser).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        id: '100',
        chatId: '10',
        senderId: '1',
        receiverId: '2',
        text: 'Hello!',
        createdAt: createdAt.toISOString(),
      }),
    );
    expect(result).toEqual({
      id: '100',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello!',
      createdAt: createdAt.toISOString(),
    });
  });

  it('должен запретить отправку сообщения самому себе', async () => {
    await expect(
      useCase.execute(
        new SendMessageCommand({
          senderId: 5,
          receiverId: 5,
          text: 'Hello!',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(chatsRepositoryMock.getOrCreate).not.toHaveBeenCalled();
    expect(messagesRepositoryMock.create).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.sendToUser).not.toHaveBeenCalled();
  });

  it('должен вызывать WS-push с MessageViewDto, где все id — строки', async () => {
    await useCase.execute(
      new SendMessageCommand({
        senderId: 1,
        receiverId: 2,
        text: 'Ping',
      }),
    );

    const [, payload] = messengerWebSocketServiceMock.sendToUser.mock.calls[0];

    expect(typeof payload.id).toBe('string');
    expect(typeof payload.chatId).toBe('string');
    expect(typeof payload.senderId).toBe('string');
    expect(typeof payload.receiverId).toBe('string');
  });
});
