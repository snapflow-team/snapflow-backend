import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '../../../../../common/exceptions/domain-exceptions';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { ChatMembershipGuard } from './chat-membership.guard';

describe('ChatMembershipGuard (unit)', () => {
  let guard: ChatMembershipGuard;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'isParticipant'>>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatMembershipGuard, { provide: ChatsRepository, useValue: chatsRepositoryMock }],
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

  it('должен вернуть 400, если в маршруте нет chatId', async () => {
    await expect(guard.canActivate(createContext({}, 1))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(chatsRepositoryMock.isParticipant).not.toHaveBeenCalled();
  });
});
