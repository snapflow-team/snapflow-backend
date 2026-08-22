import { Test, TestingModule } from '@nestjs/testing';
import { ChatReadState, Message, MessageDelivery } from '@generated/prisma-messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { MessengerResultCode } from '../../../../../common/notification/messenger-result-code';
import {
  ForbiddenException,
  NotFoundException,
} from '../../../../../common/exceptions/domain-exceptions';
import { MessageViewDto } from '../../../sharing/api/view-dto/message.view-dto';
import { ChatsRepository } from '../../../chats/infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { ChatReadStateRepository } from '../../../read-state/infrastructure/chat-read-state.repository';
import { MessengerWebSocketService } from '../../../realtime/services/messenger-websocket.service';
import { MarkMessageDeliveredCommand } from '../commands/mark-message-delivered.command';
import { MarkMessageDeliveredUseCase } from './mark-message-delivered.usecase';

describe('MarkMessageDeliveredUseCase (unit)', () => {
  let useCase: MarkMessageDeliveredUseCase;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'isParticipant'>>;
  let chatReadStateRepositoryMock: jest.Mocked<Pick<ChatReadStateRepository, 'findReadState'>>;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'findById' | 'upsertDelivery'>>;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');

  const message: Message = {
    id: 100,
    chatId: 10,
    senderId: 1,
    text: 'Hello!',
    clientMessageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    createdAt,
    editedAt: null,
    deletedAt: null,
    deletedForEveryone: false,
    replyToMessageId: null,
  };

  beforeEach(async () => {
    chatsRepositoryMock = {
      isParticipant: jest.fn().mockResolvedValue(true),
    };

    chatReadStateRepositoryMock = {
      findReadState: jest.fn().mockResolvedValue(null),
    };

    messagesRepositoryMock = {
      findById: jest.fn().mockResolvedValue(message),
      upsertDelivery: jest.fn().mockResolvedValue({} as MessageDelivery),
    };

    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkMessageDeliveredUseCase,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: ChatReadStateRepository, useValue: chatReadStateRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(MarkMessageDeliveredUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен upsert MessageDelivery и эмитить message.updated со status=delivered', async () => {
    await useCase.execute(
      new MarkMessageDeliveredCommand({
        messageId: 100,
        deliveredByUserId: 2,
      }),
    );

    expect(messagesRepositoryMock.findById).toHaveBeenCalledWith(100);
    expect(chatsRepositoryMock.isParticipant).toHaveBeenCalledWith(10, 2);
    expect(messagesRepositoryMock.upsertDelivery).toHaveBeenCalledWith(100, 2);
    expect(chatReadStateRepositoryMock.findReadState).toHaveBeenCalledWith(10, 2);

    const expectedPayload = MessageViewDto.mapToView(message, 2, {
      viewerId: 1,
      deliveredToPeer: true,
      peerLastReadMessageId: null,
    });

    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      1,
      MessengerWsEvent.MessageUpdated,
      expectedPayload,
    );
    expect(expectedPayload.status).toBe('delivered');
  });

  it('должен эмитить status=read, если peer уже прочитал сообщение', async () => {
    chatReadStateRepositoryMock.findReadState.mockResolvedValue({
      id: 1,
      chatId: 10,
      userId: 2,
      lastReadMessageId: 100,
      lastReadAt: createdAt,
    } as ChatReadState);

    await useCase.execute(
      new MarkMessageDeliveredCommand({
        messageId: 100,
        deliveredByUserId: 2,
      }),
    );

    const emittedPayload = messengerWebSocketServiceMock.emitToUser.mock
      .calls[0][2] as MessageViewDto;

    expect(emittedPayload.status).toBe('read');
  });

  it('должен бросать NotFound, если сообщение не найдено', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new MarkMessageDeliveredCommand({
          messageId: 100,
          deliveredByUserId: 2,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.MessageNotFound,
    });
    expect(messagesRepositoryMock.upsertDelivery).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен бросать Forbidden, если ACK отправляет автор сообщения', async () => {
    await expect(
      useCase.execute(
        new MarkMessageDeliveredCommand({
          messageId: 100,
          deliveredByUserId: 1,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messagesRepositoryMock.upsertDelivery).not.toHaveBeenCalled();
  });

  it('должен бросать Forbidden, если пользователь не участник чата', async () => {
    chatsRepositoryMock.isParticipant.mockResolvedValue(false);

    await expect(
      useCase.execute(
        new MarkMessageDeliveredCommand({
          messageId: 100,
          deliveredByUserId: 3,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messagesRepositoryMock.upsertDelivery).not.toHaveBeenCalled();
  });

  it('должен бросать NotFoundException с MessageNotFound', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new MarkMessageDeliveredCommand({
          messageId: 999,
          deliveredByUserId: 2,
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
