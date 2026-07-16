import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message } from '@generated/prisma-messenger';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { PrismaService } from '../../../database/prisma.service';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';
import { SendMessageCommand, SendMessageUseCase } from './send-message.usecase';

describe('SendMessageUseCase (unit)', () => {
  let useCase: SendMessageUseCase;
  let prismaMock: { $transaction: jest.Mock };
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'getOrCreate' | 'updateLastMessage'>>;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'createOrGetExisting'>>;
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

  const clientMessageId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  const message: Message = {
    id: 100,
    chatId: 10,
    senderId: 1,
    text: 'Hello!',
    clientMessageId,
    createdAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    chatsRepositoryMock = {
      getOrCreate: jest.fn().mockResolvedValue(chat),
      updateLastMessage: jest.fn().mockResolvedValue(undefined),
    };

    messagesRepositoryMock = {
      createOrGetExisting: jest.fn().mockResolvedValue({ message, isNew: true }),
    };

    messengerWebSocketServiceMock = {
      sendToUser: jest.fn(),
    };

    prismaMock = {
      $transaction: jest.fn(
        async (callback: (tx: object) => Promise<{ message: Message; isNew: boolean }>) =>
          callback({}),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendMessageUseCase,
        { provide: PrismaService, useValue: prismaMock },
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
        clientMessageId,
      }),
    );

    expect(chatsRepositoryMock.getOrCreate).toHaveBeenCalledWith(1, 2);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(messagesRepositoryMock.createOrGetExisting).toHaveBeenCalledWith(
      {
        chatId: 10,
        senderId: 1,
        text: 'Hello!',
        clientMessageId,
      },
      expect.anything(),
    );
    expect(chatsRepositoryMock.updateLastMessage).toHaveBeenCalledWith(
      10,
      message.id,
      message.createdAt,
      expect.anything(),
    );
    expect(messengerWebSocketServiceMock.sendToUser).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        id: '100',
        chatId: '10',
        senderId: '1',
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
        createdAt: createdAt.toISOString(),
      }),
    );
    expect(result).toEqual({
      id: '100',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello!',
      clientMessageId,
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
          clientMessageId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(chatsRepositoryMock.getOrCreate).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(messagesRepositoryMock.createOrGetExisting).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.sendToUser).not.toHaveBeenCalled();
  });

  it('должен вызывать WS-push с MessageViewDto, где все id — строки', async () => {
    await useCase.execute(
      new SendMessageCommand({
        senderId: 1,
        receiverId: 2,
        text: 'Ping',
        clientMessageId,
      }),
    );

    const [, payload] = messengerWebSocketServiceMock.sendToUser.mock.calls[0];

    expect(typeof payload.id).toBe('string');
    expect(typeof payload.chatId).toBe('string');
    expect(typeof payload.senderId).toBe('string');
    expect(typeof payload.receiverId).toBe('string');
  });

  it('должен вернуть существующее сообщение без повторного WS-push при дубле clientMessageId', async () => {
    messagesRepositoryMock.createOrGetExisting.mockResolvedValue({ message, isNew: false });

    const result = await useCase.execute(
      new SendMessageCommand({
        senderId: 1,
        receiverId: 2,
        text: 'Hello!',
        clientMessageId,
      }),
    );

    expect(chatsRepositoryMock.updateLastMessage).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.sendToUser).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: '100',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello!',
      clientMessageId,
      createdAt: createdAt.toISOString(),
    });
  });
});
