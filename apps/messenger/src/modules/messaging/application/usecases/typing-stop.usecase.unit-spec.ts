import { Test, TestingModule } from '@nestjs/testing';
import { Chat } from '@generated/prisma-messenger';
import { Redis } from 'ioredis';
import { MessengerWsEvent } from '../../../../../../../libs/contracts/messenger';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';
import { TypingStopCommand } from '../commands/typing-stop.command';
import { TypingStopUseCase } from './typing-stop.usecase';

describe('TypingStopUseCase (unit)', () => {
  let useCase: TypingStopUseCase;
  let redisMock: jest.Mocked<Pick<Redis, 'del'>>;
  let chatsRepositoryMock: jest.Mocked<Pick<ChatsRepository, 'findById' | 'getInterlocutorId'>>;
  let messengerWebSocketServiceMock: jest.Mocked<Pick<MessengerWebSocketService, 'emitToUser'>>;

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
      del: jest.fn().mockResolvedValue(1),
    };

    chatsRepositoryMock = {
      findById: jest.fn().mockResolvedValue(chat),
      getInterlocutorId: jest.fn().mockReturnValue(2),
    };

    messengerWebSocketServiceMock = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypingStopUseCase,
        { provide: REDIS_CLIENT_INJECT_TOKEN, useValue: redisMock },
        { provide: ChatsRepository, useValue: chatsRepositoryMock },
        { provide: MessengerWebSocketService, useValue: messengerWebSocketServiceMock },
      ],
    }).compile();

    useCase = module.get(TypingStopUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('удаляет Redis key и эмитит typing.stop peer’у', async () => {
    await useCase.execute(new TypingStopCommand({ chatId: 10, userId: 1 }));

    expect(redisMock.del).toHaveBeenCalledWith('typing:10:1');
    expect(messengerWebSocketServiceMock.emitToUser).toHaveBeenCalledWith(
      2,
      MessengerWsEvent.TypingStop,
      { chatId: '10', userId: '1' },
    );
  });

  it('не эмитит и не трогает Redis, если чат не найден', async () => {
    chatsRepositoryMock.findById.mockResolvedValue(null);

    await useCase.execute(new TypingStopCommand({ chatId: 10, userId: 1 }));

    expect(redisMock.del).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
  });

  it('не эмитит и не трогает Redis, если caller не участник чата', async () => {
    await useCase.execute(new TypingStopCommand({ chatId: 10, userId: 99 }));

    expect(redisMock.del).not.toHaveBeenCalled();
    expect(messengerWebSocketServiceMock.emitToUser).not.toHaveBeenCalled();
    expect(chatsRepositoryMock.getInterlocutorId).not.toHaveBeenCalled();
  });
});
