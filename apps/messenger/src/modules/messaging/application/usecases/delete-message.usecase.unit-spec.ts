import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Chat, Message, MessageUserDeletion } from '@generated/prisma-messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { DeleteMessageScope } from '../../api/input-dto/delete-message.query-dto';
import { MessengerResultCode } from '../../../../common/notification/messenger-result-code';
import { ForbiddenException, NotFoundException, } from '../../../../common/exceptions/domain-exceptions';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { DeleteMessageCommand } from '../commands/delete-message.command';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';
import { DeleteMessageUseCase } from './delete-message.usecase';

describe('DeleteMessageUseCase (unit)', () => {
  let useCase: DeleteMessageUseCase;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'findById' | 'getInterlocutorId'>>;
  let messagesRepositoryMock: jest.Mocked<
    Pick<MessagesRepository, 'findById' | 'upsertUserDeletion' | 'markDeletedForEveryone'>
  >;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;
  let configServiceMock: jest.Mocked<Pick<ConfigService<Configuration, true>, 'get'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');
  const deletedAt = new Date('2026-07-05T18:05:00.000Z');

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
    jest.setSystemTime(deletedAt);

    chatsRepositoryMock = {
      findById: jest.fn().mockResolvedValue(chat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
    };

    messagesRepositoryMock = {
      findById: jest.fn().mockResolvedValue(message),
      upsertUserDeletion: jest.fn().mockResolvedValue({} as MessageUserDeletion),
      markDeletedForEveryone: jest.fn().mockResolvedValue({
        ...message,
        text: '',
        deletedAt,
        deletedForEveryone: true,
      }),
    };

    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue({
        messageDeleteForEveryoneWindowMs: 900_000,
      } as BusinessRulesSettings),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteMessageUseCase,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(DeleteMessageUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('scope=me: должен upsert MessageUserDeletion и эмитить message.deleted только себе', async () => {
    await useCase.execute(
      new DeleteMessageCommand({
        messageId: 100,
        userId: 2,
        scope: DeleteMessageScope.Me,
      }),
    );

    expect(messagesRepositoryMock.upsertUserDeletion).toHaveBeenCalledWith(100, 2);
    expect(messagesRepositoryMock.markDeletedForEveryone).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledTimes(1);
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.MessageDeleted,
      {
        messageId: '100',
        chatId: '10',
        scope: DeleteMessageScope.Me,
      },
    );
  });

  it('scope=everyone: должен очистить текст, выставить tombstone и эмитить обоим', async () => {
    await useCase.execute(
      new DeleteMessageCommand({
        messageId: 100,
        userId: 1,
        scope: DeleteMessageScope.Everyone,
      }),
    );

    expect(messagesRepositoryMock.markDeletedForEveryone).toHaveBeenCalledWith(100, deletedAt);
    expect(messagesRepositoryMock.upsertUserDeletion).not.toHaveBeenCalled();
    expect(chatsRepositoryMock.getInterlocutorId).toHaveBeenCalledWith(chat, 1);
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      1,
      MessengerWsEvent.MessageDeleted,
      {
        messageId: '100',
        chatId: '10',
        scope: DeleteMessageScope.Everyone,
      },
    );
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.MessageDeleted,
      {
        messageId: '100',
        chatId: '10',
        scope: DeleteMessageScope.Everyone,
      },
    );
  });

  it('scope=everyone: должен быть no-op, если сообщение уже удалено для всех', async () => {
    messagesRepositoryMock.findById.mockResolvedValue({
      ...message,
      deletedForEveryone: true,
      deletedAt: createdAt,
      text: '',
    });

    await useCase.execute(
      new DeleteMessageCommand({
        messageId: 100,
        userId: 1,
        scope: DeleteMessageScope.Everyone,
      }),
    );

    expect(messagesRepositoryMock.markDeletedForEveryone).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен бросать NotFound, если сообщение не найдено', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new DeleteMessageCommand({
          messageId: 100,
          userId: 1,
          scope: DeleteMessageScope.Everyone,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.MessageNotFound,
    });
    expect(messagesRepositoryMock.markDeletedForEveryone).not.toHaveBeenCalled();
  });

  it('scope=everyone: должен бросать Forbidden, если удаляет не автор', async () => {
    await expect(
      useCase.execute(
        new DeleteMessageCommand({
          messageId: 100,
          userId: 2,
          scope: DeleteMessageScope.Everyone,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messagesRepositoryMock.markDeletedForEveryone).not.toHaveBeenCalled();
  });

  it('scope=everyone: должен бросать DeleteWindowExpired, если окно истекло', async () => {
    jest.setSystemTime(new Date(createdAt.getTime() + 900_001));

    await expect(
      useCase.execute(
        new DeleteMessageCommand({
          messageId: 100,
          userId: 1,
          scope: DeleteMessageScope.Everyone,
        }),
      ),
    ).rejects.toMatchObject({
      code: MessengerResultCode.DeleteWindowExpired,
    });
    expect(messagesRepositoryMock.markDeletedForEveryone).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('должен бросать NotFoundException с MessageNotFound', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new DeleteMessageCommand({
          messageId: 999,
          userId: 1,
          scope: DeleteMessageScope.Me,
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
