import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Message } from '@generated/prisma-messenger';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { ChatMembershipGuard } from './chat-membership.guard';

describe('ChatMembershipGuard (unit)', () => {
  let guard: ChatMembershipGuard;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'isParticipant'>>;
  let messagesRepositoryMock: jest.Mocked<Pick<MessagesRepository, 'findById'>>;

  const createdAt = new Date('2026-07-05T18:00:00.000Z');

  const message: Message = {
    id: 100,
    chatId: 10,
    senderId: 1,
    text: 'Hello!',
    clientMessageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    createdAt,
  };

  const createContext = (
    params: Record<string, string | undefined>,
    userId?: number,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          user: userId === undefined ? undefined : { id: userId },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    chatsRepositoryMock = {
      isParticipant: jest.fn(),
    };

    messagesRepositoryMock = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatMembershipGuard,
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessagesRepository, useValue: messagesRepositoryMock },
      ],
    }).compile();

    guard = module.get(ChatMembershipGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('должен вернуть 401, если пользователь не аутентифицирован', async () => {
    await expect(guard.canActivate(createContext({ chatId: '10' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(chatsRepositoryMock.isParticipant).not.toHaveBeenCalled();
  });

  it('должен разрешить доступ участнику чата по chatId', async () => {
    chatsRepositoryMock.isParticipant.mockResolvedValue(true);

    await expect(guard.canActivate(createContext({ chatId: '10' }, 1))).resolves.toBe(true);

    expect(chatsRepositoryMock.isParticipant).toHaveBeenCalledWith(10, 1);
    expect(messagesRepositoryMock.findById).not.toHaveBeenCalled();
  });

  it('должен вернуть 403, если пользователь не участник чата по chatId', async () => {
    chatsRepositoryMock.isParticipant.mockResolvedValue(false);

    await expect(guard.canActivate(createContext({ chatId: '10' }, 3))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(chatsRepositoryMock.isParticipant).toHaveBeenCalledWith(10, 3);
  });

  it('должен вернуть 400 при невалидном chatId', async () => {
    await expect(guard.canActivate(createContext({ chatId: 'abc' }, 1))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(chatsRepositoryMock.isParticipant).not.toHaveBeenCalled();
  });

  it('должен разрешить доступ участнику чата по messageId', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(message);
    chatsRepositoryMock.isParticipant.mockResolvedValue(true);

    await expect(guard.canActivate(createContext({ messageId: '100' }, 2))).resolves.toBe(true);

    expect(messagesRepositoryMock.findById).toHaveBeenCalledWith(100);
    expect(chatsRepositoryMock.isParticipant).toHaveBeenCalledWith(10, 2);
  });

  it('должен вернуть 403, если сообщение не найдено', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(null);

    await expect(guard.canActivate(createContext({ messageId: '999' }, 1))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(chatsRepositoryMock.isParticipant).not.toHaveBeenCalled();
  });

  it('должен вернуть 403, если пользователь не участник чата сообщения', async () => {
    messagesRepositoryMock.findById.mockResolvedValue(message);
    chatsRepositoryMock.isParticipant.mockResolvedValue(false);

    await expect(guard.canActivate(createContext({ messageId: '100' }, 3))).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(chatsRepositoryMock.isParticipant).toHaveBeenCalledWith(10, 3);
  });

  it('должен вернуть 400, если в маршруте нет chatId и messageId', async () => {
    await expect(guard.canActivate(createContext({}, 1))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(chatsRepositoryMock.isParticipant).not.toHaveBeenCalled();
    expect(messagesRepositoryMock.findById).not.toHaveBeenCalled();
  });
});
