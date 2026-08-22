import { Test, TestingModule } from '@nestjs/testing';
import { Chat, ChatReadState, Message } from '@generated/prisma-messenger';
import {
  ChatUpdatedPayload,
  MessageReadPayload,
  MessengerWsEvent,
  UnreadUpdatedPayload,
} from '@contracts/messenger';
import { MessengerResultCode } from '../../../../common/notification/messenger-result-code';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';
import { MarkChatReadCommand, MarkChatReadUseCase } from './mark-chat-read.usecase';

describe('MarkChatReadUseCase (unit)', () => {
  let useCase: MarkChatReadUseCase;
  let chatsRepositoryMock: jest.Mocked<
    Pick<ChatsRepository, 'findReadState' | 'upsertReadState' | 'findById' | 'getInterlocutorId'>
  >;
  let chatsQueryRepositoryMock: jest.Mocked<
    Pick<ChatsQueryRepository, 'getUnreadCount' | 'getTotalUnreadCount'>
  >;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'findById'>>;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const readAt = new Date('2026-07-05T18:05:00.000Z');

  const chat: Chat = {
    id: 10,
    participantAId: 1,
    participantBId: 2,
    lastMessageId: 100,
    lastMessageAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  const message: Message = {
    id: 100,
    chatId: 10,
    senderId: 2,
    text: 'Hello!',
    clientMessageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    createdAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(readAt);

    chatsRepositoryMock = {
      findReadState: jest.fn().mockResolvedValue(null),
      upsertReadState: jest.fn().mockResolvedValue({} as ChatReadState),
      findById: jest.fn().mockResolvedValue(chat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
    };

    chatsQueryRepositoryMock = {
      getUnreadCount: jest.fn().mockImplementation((_chatId: number, readerId: number) => {
        return Promise.resolve(readerId === 1 ? 0 : 3);
      }),
      getTotalUnreadCount: jest.fn().mockResolvedValue(0),
    };

    messagesRepositoryMock = {
      findById: jest.fn().mockResolvedValue(message),
    };

    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkChatReadUseCase,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: ChatsQueryRepository, useValue: chatsQueryRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(MarkChatReadUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('должен upsert read state и эмитить message.read + chat.updated + unread.updated', async () => {
    await useCase.execute(
      new MarkChatReadCommand({
        chatId: 10,
        readerId: 1,
        lastReadMessageId: 100,
      }),
    );

    expect(messagesRepositoryMock.findById).toHaveBeenCalledWith(100);
    expect(chatsRepositoryMock.findReadState).toHaveBeenCalledWith(10, 1);
    expect(chatsRepositoryMock.upsertReadState).toHaveBeenCalledWith(10, 1, 100, readAt);
    expect(chatsRepositoryMock.getInterlocutorId).toHaveBeenCalledWith(chat, 1);
    expect(chatsQueryRepositoryMock.getTotalUnreadCount).toHaveBeenCalledWith(1);

    const expectedMessageReadPayload: MessageReadPayload = {
      chatId: '10',
      lastReadMessageId: '100',
      readByUserId: '1',
      readAt: readAt.toISOString(),
    };
    const expectedReaderChatUpdated: ChatUpdatedPayload = {
      chatId: '10',
      unreadCount: 0,
    };
    const expectedPeerChatUpdated: ChatUpdatedPayload = {
      chatId: '10',
      unreadCount: 3,
    };
    const expectedUnreadUpdated: UnreadUpdatedPayload = {
      total: 0,
    };

    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.MessageRead,
      expectedMessageReadPayload,
    );
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      1,
      MessengerWsEvent.ChatUpdated,
      expectedReaderChatUpdated,
    );
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.ChatUpdated,
      expectedPeerChatUpdated,
    );
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      1,
      MessengerWsEvent.UnreadUpdated,
      expectedUnreadUpdated,
    );
  });

  it('должен делать no-op без upsert и emit, если lastReadMessageId не растёт', async () => {
    chatsRepositoryMock.findReadState.mockResolvedValue({
      id: 1,
      chatId: 10,
      userId: 1,
      lastReadMessageId: 100,
      lastReadAt: createdAt,
    });

    await useCase.execute(
      new MarkChatReadCommand({
        chatId: 10,
        readerId: 1,
        lastReadMessageId: 100,
      }),
    );

    expect(chatsRepositoryMock.upsertReadState).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен делать no-op при попытке даунгрейда lastReadMessageId', async () => {
    chatsRepositoryMock.findReadState.mockResolvedValue({
      id: 1,
      chatId: 10,
      userId: 1,
      lastReadMessageId: 150,
      lastReadAt: createdAt,
    });

    await useCase.execute(
      new MarkChatReadCommand({
        chatId: 10,
        readerId: 1,
        lastReadMessageId: 100,
      }),
    );

    expect(chatsRepositoryMock.upsertReadState).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен бросать NotFound, если сообщение не найдено', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new MarkChatReadCommand({
          chatId: 10,
          readerId: 1,
          lastReadMessageId: 100,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.MessageNotFound,
    });
    expect(chatsRepositoryMock.upsertReadState).not.toHaveBeenCalled();
  });

  it('должен бросать NotFound, если сообщение из другого чата', async () => {
    messagesRepositoryMock.findById.mockResolvedValue({
      ...message,
      chatId: 99,
    });

    await expect(
      useCase.execute(
        new MarkChatReadCommand({
          chatId: 10,
          readerId: 1,
          lastReadMessageId: 100,
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(chatsRepositoryMock.upsertReadState).not.toHaveBeenCalled();
  });
});
