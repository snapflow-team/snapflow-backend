import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Chat } from '@generated/prisma-messenger';
import { Redis } from 'ioredis';
import { MessengerWsEvent } from '@contracts/messenger';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';
import { TypingStartCommand } from '../commands/typing-start.command';
import { TypingStartUseCase } from './typing-start.usecase';

describe('TypingStartUseCase (unit)', () => {
  let useCase: TypingStartUseCase;
  let redisMock: jest.Mocked<Pick<Redis, 'set'>>;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'findById' | 'getInterlocutorId'>>;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;
  let configServiceMock: jest.Mocked<Pick<ConfigService<Configuration, true>, 'get'>>;

  const chat: Chat = {
    id: 10,
    participantAId: 1,
    participantBId: 2,
    lastMessageId: null,
    lastMessageAt: null,
    createdAt: new Date('2026-07-05T18:00:00.000Z'),
    updatedAt: new Date('2026-07-05T18:00:00.000Z'),
  };

  beforeEach(async () => {
    redisMock = {
      set: jest.fn().mockResolvedValue('OK'),
    };

    chatsRepositoryMock = {
      findById: jest.fn().mockResolvedValue(chat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
    };

    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue({ typingTtlSeconds: 3 } as BusinessRulesSettings),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypingStartUseCase,
        { provide: REDIS_CLIENT_INJECT_TOKEN, useValue: redisMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(TypingStartUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('ставит Redis key с TTL и эмитит typing.start peer’у', async () => {
    await useCase.execute(new TypingStartCommand({ chatId: 10, userId: 1 }));

    expect(chatsRepositoryMock.findById).toHaveBeenCalledWith(10);
    expect(chatsRepositoryMock.getInterlocutorId).toHaveBeenCalledWith(chat, 1);
    expect(redisMock.set).toHaveBeenCalledWith('typing:10:1', '1', 'EX', 3);
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.TypingStart,
      { chatId: '10', userId: '1' },
    );
  });

  it('повторный вызов обновляет TTL (SET с EX)', async () => {
    await useCase.execute(new TypingStartCommand({ chatId: 10, userId: 1 }));
    await useCase.execute(new TypingStartCommand({ chatId: 10, userId: 1 }));

    expect(redisMock.set).toHaveBeenCalledTimes(2);
    expect(redisMock.set).toHaveBeenNthCalledWith(2, 'typing:10:1', '1', 'EX', 3);
  });

  it('не эмитит и не пишет в Redis, если чат не найден', async () => {
    chatsRepositoryMock.findById.mockResolvedValue(null);

    await useCase.execute(new TypingStartCommand({ chatId: 10, userId: 1 }));

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('не эмитит и не пишет в Redis, если caller не участник чата', async () => {
    await useCase.execute(new TypingStartCommand({ chatId: 10, userId: 99 }));

    expect(redisMock.set).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
    expect(chatsRepositoryMock.getInterlocutorId).not.toHaveBeenCalled();
  });
});
