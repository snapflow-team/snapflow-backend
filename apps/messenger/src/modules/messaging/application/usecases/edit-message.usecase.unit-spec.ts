import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Chat, ChatReadState, Message, MessageDelivery } from '@generated/prisma-messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { MessengerResultCode } from '../../../../common/notification/messenger-result-code';
import {
  ForbiddenException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { MessageViewDto } from '../../sharing/api/view-dto/message.view-dto';
import { EditMessageCommand } from '../commands/edit-message.command';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';
import { EditMessageUseCase } from './edit-message.usecase';

describe('EditMessageUseCase (unit)', () => {
  let useCase: EditMessageUseCase;
  let chatsRepositoryMock: jest.Mocked<
    Pick<ChatsRepository, 'findById' | 'getInterlocutorId' | 'findReadState'>
  >;
  let messagesRepositoryMock: jest.Mocked<
    Pick<MessagesRepository, 'findById' | 'updateText' | 'findDelivery'>
  >;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;
  let configServiceMock: jest.Mocked<Pick<ConfigService<Configuration, true>, 'get'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const editedAt = new Date('2026-07-05T18:05:00.000Z');

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

  const updatedMessage: Message = {
    ...message,
    text: 'Updated text',
    editedAt,
  };

  const chat: Chat = {
    id: 10,
    participantAId: 1,
    participantBId: 2,
    lastMessageId: 100,
    lastMessageAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(editedAt);

    chatsRepositoryMock = {
      findById: jest.fn().mockResolvedValue(chat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
      findReadState: jest.fn().mockResolvedValue(null),
    };

    messagesRepositoryMock = {
      findById: jest.fn().mockResolvedValue(message),
      updateText: jest.fn().mockResolvedValue(updatedMessage),
      findDelivery: jest.fn().mockResolvedValue(null),
    };

    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue({ messageEditWindowMs: 900_000 } as BusinessRulesSettings),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditMessageUseCase,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(EditMessageUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('должен обновить текст, выставить editedAt и эмитить message.updated обоим участникам', async () => {
    const result = await useCase.execute(
      new EditMessageCommand({
        messageId: 100,
        editorId: 1,
        text: 'Updated text',
      }),
    );

    expect(messagesRepositoryMock.findById).toHaveBeenCalledWith(100);
    expect(messagesRepositoryMock.updateText).toHaveBeenCalledWith(100, 'Updated text', editedAt);
    expect(chatsRepositoryMock.getInterlocutorId).toHaveBeenCalledWith(chat, 1);
    expect(messagesRepositoryMock.findDelivery).toHaveBeenCalledWith(100, 2);
    expect(chatsRepositoryMock.findReadState).toHaveBeenCalledWith(10, 2);

    const expectedAuthorView = MessageViewDto.mapToView(updatedMessage, 2, {
      viewerId: 1,
      deliveredToPeer: false,
      peerLastReadMessageId: null,
    });
    const expectedPeerView = MessageViewDto.mapToView(updatedMessage, 2, {
      viewerId: 2,
    });

    expect(result).toEqual(expectedAuthorView);
    expect(result.editedAt).toBe(editedAt.toISOString());
    expect(result.status).toBe('sent');
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      1,
      MessengerWsEvent.MessageUpdated,
      expectedAuthorView,
    );
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.MessageUpdated,
      expectedPeerView,
    );
  });

  it('должен сохранять status=delivered в ответе автору, если peer уже ACK’нул доставку', async () => {
    messagesRepositoryMock.findDelivery.mockResolvedValue({} as MessageDelivery);

    const result = await useCase.execute(
      new EditMessageCommand({
        messageId: 100,
        editorId: 1,
        text: 'Updated text',
      }),
    );

    expect(result.status).toBe('delivered');
  });

  it('должен сохранять status=read в ответе автору, если peer уже прочитал сообщение', async () => {
    messagesRepositoryMock.findDelivery.mockResolvedValue({} as MessageDelivery);
    chatsRepositoryMock.findReadState.mockResolvedValue({
      id: 1,
      chatId: 10,
      userId: 2,
      lastReadMessageId: 100,
      lastReadAt: createdAt,
    } as ChatReadState);

    const result = await useCase.execute(
      new EditMessageCommand({
        messageId: 100,
        editorId: 1,
        text: 'Updated text',
      }),
    );

    expect(result.status).toBe('read');
  });

  it('должен бросать NotFound, если сообщение не найдено', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new EditMessageCommand({
          messageId: 100,
          editorId: 1,
          text: 'Updated text',
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.MessageNotFound,
    });
    expect(messagesRepositoryMock.updateText).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен бросать Forbidden, если редактирует не автор', async () => {
    await expect(
      useCase.execute(
        new EditMessageCommand({
          messageId: 100,
          editorId: 2,
          text: 'Updated text',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messagesRepositoryMock.updateText).not.toHaveBeenCalled();
  });

  it('должен бросать Forbidden, если сообщение удалено для всех', async () => {
    messagesRepositoryMock.findById.mockResolvedValue({
      ...message,
      deletedForEveryone: true,
      deletedAt: createdAt,
      text: '',
    });

    await expect(
      useCase.execute(
        new EditMessageCommand({
          messageId: 100,
          editorId: 1,
          text: 'Updated text',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messagesRepositoryMock.updateText).not.toHaveBeenCalled();
  });

  it('должен бросать EditWindowExpired, если окно редактирования истекло', async () => {
    jest.setSystemTime(new Date(createdAt.getTime() + 900_001));

    await expect(
      useCase.execute(
        new EditMessageCommand({
          messageId: 100,
          editorId: 1,
          text: 'Updated text',
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.EditWindowExpired,
    });
    expect(messagesRepositoryMock.updateText).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен бросать NotFoundException с MessageNotFound', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new EditMessageCommand({
          messageId: 999,
          editorId: 1,
          text: 'Updated text',
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
