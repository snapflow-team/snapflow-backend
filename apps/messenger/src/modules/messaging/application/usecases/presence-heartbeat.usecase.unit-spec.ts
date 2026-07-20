import { Test, TestingModule } from '@nestjs/testing';
import { PresenceHeartbeatCommand } from '../commands/presence-heartbeat.command';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceHeartbeatUseCase } from './presence-heartbeat.usecase';

describe('PresenceHeartbeatUseCase (unit)', () => {
  let useCase: PresenceHeartbeatUseCase;
  let presenceRedisRepositoryMock: jest.Mocked<Pick<PresenceRedisRepository, 'refresh'>>;

  beforeEach(async () => {
    presenceRedisRepositoryMock = {
      refresh: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceHeartbeatUseCase,
        { provide: PresenceRedisRepository, useValue: presenceRedisRepositoryMock },
      ],
    }).compile();

    useCase = module.get(PresenceHeartbeatUseCase);
  });

  it('обновляет TTL сокета в Redis', async () => {
    await useCase.execute(new PresenceHeartbeatCommand({ userId: 7, socketId: 'sock-7' }));

    expect(presenceRedisRepositoryMock.refresh).toHaveBeenCalledWith(7, 'sock-7');
  });
});
