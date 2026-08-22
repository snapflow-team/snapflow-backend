import { Test, TestingModule } from '@nestjs/testing';
import { ChatReadState, Message, MessageDelivery } from '@generated/prisma-messenger';
import { ChatMuteRepository } from '../../../infrastructure/chat-mute.repository';
import { ChatsRepository } from '../../../infrastructure/chats.repository';
import { MessagesRepository } from '../../../infrastructure/messages.repository';
import { PresenceRedisRepository } from '../../../presence/infrastructure/presence-redis.repository';
import { NewMessageNotificationPolicy } from './new-message-notification.policy';

describe('NewMessageNotificationPolicy (unit)', () => {
  let policy: NewMessageNotificationPolicy;
  let messagesRepositoryMock: Pick<MessagesRepository, 'findById' | 'findDelivery'>;
  let presenceRedisRepositoryMock: Pick<PresenceRedisRepository, 'getOnline'>;
  let chatsRepositoryMock: Pick<ChatsRepository, 'findReadState'>;
  let chatMuteRepositoryMock: Pick<ChatMuteRepository, 'isMuted'>;

  const message: Message = {
    id: 100,
    chatId: 10,
    senderId: 1,
    text: 'hello',
    clientMessageId: '11111111-1111-1111-1111-111111111111',
    createdAt: new Date('2026-08-02T12:00:00.000Z'),
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    messagesRepositoryMock = {
      findById: jest.fn().mockResolvedValue(message),
      findDelivery: jest.fn().mockResolvedValue(null),
    };
    presenceRedisRepositoryMock = {
      getOnline: jest.fn().mockResolvedValue(new Map([[2, false]])),
    };
    chatsRepositoryMock = {
      findReadState: jest.fn().mockResolvedValue(null),
    };
    chatMuteRepositoryMock = {
      isMuted: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewMessageNotificationPolicy,
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: PresenceRedisRepository, useValue: presenceRedisRepositoryMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: ChatMuteRepository, useValue: chatMuteRepositoryMock },
      ],
    }).compile();

    policy = module.get(NewMessageNotificationPolicy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const input = { chatId: 10, messageId: 100, recipientId: 2 };

  it('разрешает пуш для офлайн-получателя без delivery/read/mute', async () => {
    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: true,
      message,
    });
  });

  it('пропускает, если сообщение отсутствует', async () => {
    (messagesRepositoryMock.findById as jest.Mock).mockResolvedValue(null);

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: false,
      reason: 'message_missing_or_deleted',
    });
    expect(presenceRedisRepositoryMock.getOnline).not.toHaveBeenCalled();
  });

  it('пропускает, если сообщение удалено для всех', async () => {
    (messagesRepositoryMock.findById as jest.Mock).mockResolvedValue({
      ...message,
      deletedForEveryone: true,
    });

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: false,
      reason: 'message_missing_or_deleted',
    });
  });

  it('пропускает, если получатель онлайн', async () => {
    (presenceRedisRepositoryMock.getOnline as jest.Mock).mockResolvedValue(new Map([[2, true]]));

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: false,
      reason: 'recipient_online',
    });
    expect(messagesRepositoryMock.findDelivery).not.toHaveBeenCalled();
  });

  it('пропускает, если сообщение уже доставлено', async () => {
    (messagesRepositoryMock.findDelivery as jest.Mock).mockResolvedValue({
      id: 1,
      messageId: 100,
      userId: 2,
      deliveredAt: new Date(),
    } as MessageDelivery);

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: false,
      reason: 'message_delivered',
    });
    expect(chatsRepositoryMock.findReadState).not.toHaveBeenCalled();
  });

  it('пропускает, если сообщение уже прочитано', async () => {
    (chatsRepositoryMock.findReadState as jest.Mock).mockResolvedValue({
      id: 1,
      chatId: 10,
      userId: 2,
      lastReadMessageId: 100,
      lastReadAt: new Date(),
    } as ChatReadState);

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: false,
      reason: 'message_read',
    });
    expect(chatMuteRepositoryMock.isMuted).not.toHaveBeenCalled();
  });

  it('не считает прочитанным, если lastReadMessageId меньше messageId', async () => {
    (chatsRepositoryMock.findReadState as jest.Mock).mockResolvedValue({
      id: 1,
      chatId: 10,
      userId: 2,
      lastReadMessageId: 99,
      lastReadAt: new Date(),
    } as ChatReadState);

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: true,
      message,
    });
  });

  it('пропускает, если чат замучен', async () => {
    (chatMuteRepositoryMock.isMuted as jest.Mock).mockResolvedValue(true);

    await expect(policy.shouldNotify(input)).resolves.toEqual({
      shouldNotify: false,
      reason: 'chat_muted',
    });
  });
});
