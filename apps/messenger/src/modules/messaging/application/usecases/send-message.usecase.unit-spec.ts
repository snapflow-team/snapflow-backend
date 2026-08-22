import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message, OutboxEventType } from '@generated/prisma-messenger';
import {
  ChatUpdatedPayload,
  MessengerWsEvent,
  UnreadUpdatedPayload,
} from '@contracts/messenger';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { MessengerResultCode } from '../../../../common/notification/messenger-result-code';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { PrismaService } from '../../../database/prisma.service';
import { OutboxRepository } from '../../../outbox/repositories/outbox.repository';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';
import { SendMessageCommand, SendMessageUseCase } from './send-message.usecase';

describe('SendMessageUseCase (unit)', () => {
  let useCase: SendMessageUseCase;
  let prismaMock: { $transaction: jest.Mock };
  let configServiceMock: jest.Mocked<Pick<ConfigService<Configuration, true>, 'get'>>;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'getOrCreate' | 'updateLastMessage'>>;
  let chatsQueryRepositoryMock: jest.Mocked<
    Pick<ChatsQueryRepository, 'getUnreadCount' | 'getTotalUnreadCount'>
  >;
  let messagesRepositoryMock: jest.Mocked<
    Pick<MessagesRepository, 'createOrGetExisting' | 'findById' | 'findUserDeletion'>
  >;
  let outboxRepositoryMock: jest.Mocked<Pick<OutboxRepository, 'saveEvent'>>;
  let messengerWebSocketServiceMock: jest.Mocked<
    Pick<MessengerWebSocketService, 'sendToUser' | 'emitToUser'>
  >;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const pushNotificationDelaySeconds = 20;

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

  const replyTarget: Message = {
    id: 50,
    chatId: 10,
    senderId: 2,
    text: 'Original',
    clientMessageId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    createdAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(createdAt);

    chatsRepositoryMock = {
      getOrCreate: jest.fn().mockResolvedValue(chat),
      updateLastMessage: jest.fn().mockResolvedValue(undefined),
    };

    chatsQueryRepositoryMock = {
      getUnreadCount: jest.fn().mockResolvedValue(1),
      getTotalUnreadCount: jest.fn().mockResolvedValue(5),
    };

    messagesRepositoryMock = {
      createOrGetExisting: jest.fn().mockResolvedValue({ message, isNew: true }),
      findById: jest.fn(),
      findUserDeletion: jest.fn().mockResolvedValue(null),
    };

    outboxRepositoryMock = {
      saveEvent: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    };

    messengerWebSocketServiceMock = {
      sendToUser: jest.fn(),
      emitToUser: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue({
        pushNotificationDelaySeconds,
      } as BusinessRulesSettings),
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
        { provide: ConfigService, useValue: configServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: ChatsQueryRepository, useValue: chatsQueryRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: OutboxRepository, useValue: outboxRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(SendMessageUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('должен get-or-create чат, сохранить сообщение, outbox и отправить WS-события получателю', async () => {
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
    expect(outboxRepositoryMock.saveEvent).toHaveBeenCalledWith(
      OutboxEventType.NEW_MESSAGE_NOTIFICATION,
      {
        chatId: 10,
        messageId: message.id,
        senderId: 1,
        recipientId: 2,
      },
      new Date(createdAt.getTime() + pushNotificationDelaySeconds * 1000),
      expect.anything(),
    );
    expect(chatsQueryRepositoryMock.getUnreadCount).toHaveBeenCalledWith(10, 2);
    expect(chatsQueryRepositoryMock.getTotalUnreadCount).toHaveBeenCalledWith(2);
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
        status: null,
        editedAt: null,
        deletedAt: null,
        deletedForEveryone: false,
        replyTo: null,
      }),
    );

    const expectedChatUpdated: ChatUpdatedPayload = {
      chatId: '10',
      unreadCount: 1,
    };
    const expectedUnreadUpdated: UnreadUpdatedPayload = {
      total: 5,
    };

    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.ChatUpdated,
      expectedChatUpdated,
    );
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.UnreadUpdated,
      expectedUnreadUpdated,
    );
    expect(result).toEqual({
      id: '100',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello!',
      clientMessageId,
      createdAt: createdAt.toISOString(),
      status: 'sent',
      editedAt: null,
      deletedAt: null,
      deletedForEveryone: false,
      replyTo: null,
    });
  });

  it('должен сохранить replyToMessageId и вернуть replyTo preview', async () => {
    const messageWithReply: Message = {
      ...message,
      replyToMessageId: replyTarget.id,
    };
    messagesRepositoryMock.findById.mockResolvedValue(replyTarget);
    messagesRepositoryMock.createOrGetExisting.mockResolvedValue({
      message: messageWithReply,
      isNew: true,
    });

    const result = await useCase.execute(
      new SendMessageCommand({
        senderId: 1,
        receiverId: 2,
        text: 'Hello!',
        clientMessageId,
        replyToMessageId: replyTarget.id,
      }),
    );

    expect(messagesRepositoryMock.findById).toHaveBeenCalledWith(replyTarget.id);
    expect(messagesRepositoryMock.findUserDeletion).toHaveBeenCalledWith(replyTarget.id, 1);
    expect(messagesRepositoryMock.createOrGetExisting).toHaveBeenCalledWith(
      {
        chatId: 10,
        senderId: 1,
        text: 'Hello!',
        clientMessageId,
        replyToMessageId: replyTarget.id,
      },
      expect.anything(),
    );
    expect(result.replyTo).toEqual({
      id: '50',
      senderId: '2',
      text: 'Original',
      deletedForEveryone: false,
    });
    expect(messengerWebSocketServiceMock.sendToUser).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        replyTo: {
          id: '50',
          senderId: '2',
          text: 'Original',
          deletedForEveryone: false,
        },
      }),
    );
  });

  it('должен разрешить reply на everyone-deleted с text: null в preview', async () => {
    const deletedReplyTarget: Message = {
      ...replyTarget,
      text: '',
      deletedForEveryone: true,
      deletedAt: createdAt,
    };
    const messageWithReply: Message = {
      ...message,
      replyToMessageId: deletedReplyTarget.id,
    };
    messagesRepositoryMock.findById.mockResolvedValue(deletedReplyTarget);
    messagesRepositoryMock.createOrGetExisting.mockResolvedValue({
      message: messageWithReply,
      isNew: true,
    });

    const result = await useCase.execute(
      new SendMessageCommand({
        senderId: 1,
        receiverId: 2,
        text: 'Reply to deleted',
        clientMessageId,
        replyToMessageId: deletedReplyTarget.id,
      }),
    );

    expect(result.replyTo).toEqual({
      id: '50',
      senderId: '2',
      text: null,
      deletedForEveryone: true,
    });
  });

  it('должен вернуть ReplyTargetInvalid, если цель ответа не найдена', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new SendMessageCommand({
          senderId: 1,
          receiverId: 2,
          text: 'Hello!',
          clientMessageId,
          replyToMessageId: 999,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.ReplyTargetInvalid,
    });

    expect(messagesRepositoryMock.createOrGetExisting).not.toHaveBeenCalled();
  });

  it('должен вернуть ReplyTargetInvalid, если цель ответа из другого чата', async () => {
    messagesRepositoryMock.findById.mockResolvedValue({
      ...replyTarget,
      chatId: 99,
    });

    await expect(
      useCase.execute(
        new SendMessageCommand({
          senderId: 1,
          receiverId: 2,
          text: 'Hello!',
          clientMessageId,
          replyToMessageId: replyTarget.id,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.ReplyTargetInvalid,
    });

    expect(messagesRepositoryMock.createOrGetExisting).not.toHaveBeenCalled();
  });

  it('должен вернуть ReplyTargetInvalid, если цель ответа скрыта у отправителя', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(replyTarget);
    messagesRepositoryMock.findUserDeletion.mockResolvedValue({
      id: 1,
      messageId: replyTarget.id,
      userId: 1,
      deletedAt: createdAt,
    });

    await expect(
      useCase.execute(
        new SendMessageCommand({
          senderId: 1,
          receiverId: 2,
          text: 'Hello!',
          clientMessageId,
          replyToMessageId: replyTarget.id,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.ReplyTargetInvalid,
    });

    expect(messagesRepositoryMock.createOrGetExisting).not.toHaveBeenCalled();
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
    expect(outboxRepositoryMock.saveEvent).not.toHaveBeenCalled();
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

  it('должен вернуть существующее сообщение без outbox и WS при дубле clientMessageId', async () => {
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
    expect(outboxRepositoryMock.saveEvent).not.toHaveBeenCalled();
    expect(chatsQueryRepositoryMock.getUnreadCount).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.sendToUser).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: '100',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello!',
      clientMessageId,
      createdAt: createdAt.toISOString(),
      status: 'sent',
      editedAt: null,
      deletedAt: null,
      deletedForEveryone: false,
      replyTo: null,
    });
  });
});
