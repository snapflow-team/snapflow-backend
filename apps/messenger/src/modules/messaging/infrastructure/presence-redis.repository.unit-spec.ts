import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../core/providers/provide-tokens/redis-client.inject-token';
import { BusinessRulesSettings } from '../../../setup/configuration/business-rules-settings';
import { PresenceRedisRepository } from './presence-redis.repository';

describe('PresenceRedisRepository (unit)', () => {
  let repository: PresenceRedisRepository;
  let redisMock: {
    zremrangebyscore: jest.Mock;
    zcard: jest.Mock;
    multi: jest.Mock;
    pipeline: jest.Mock;
  };
  let multiMock: {
    zadd: jest.Mock;
    expire: jest.Mock;
    zrem: jest.Mock;
    zremrangebyscore: jest.Mock;
    zcard: jest.Mock;
    exec: jest.Mock;
  };
  let pipelineMock: {
    zremrangebyscore: jest.Mock;
    zcard: jest.Mock;
    exec: jest.Mock;
  };

  beforeEach(async () => {
    multiMock = {
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zrem: jest.fn().mockReturnThis(),
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 0],
      ]),
    };
    pipelineMock = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };
    redisMock = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      multi: jest.fn().mockReturnValue(multiMock),
      pipeline: jest.fn().mockReturnValue(pipelineMock),
    };

    const configServiceMock = {
      get: jest.fn().mockReturnValue({ presenceHeartbeatTtlSeconds: 30 } as BusinessRulesSettings),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceRedisRepository,
        { provide: REDIS_CLIENT_INJECT_TOKEN, useValue: redisMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    repository = module.get(PresenceRedisRepository);
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('addConnection: возвращает true, если пользователь был offline', async () => {
    redisMock.zcard.mockResolvedValue(0);

    await expect(repository.addConnection(7, 'sock-1')).resolves.toBe(true);
    expect(redisMock.zremrangebyscore).toHaveBeenCalledWith('presence:7', '-inf', 970_000);
    expect(multiMock.zadd).toHaveBeenCalledWith('presence:7', 1_000_000, 'sock-1');
    expect(multiMock.expire).toHaveBeenCalledWith('presence:7', 30);
  });

  it('addConnection: возвращает false, если уже был online', async () => {
    redisMock.zcard.mockResolvedValue(2);

    await expect(repository.addConnection(7, 'sock-2')).resolves.toBe(false);
  });

  it('refresh: обновляет score и TTL', async () => {
    await repository.refresh(7, 'sock-1');

    expect(multiMock.zadd).toHaveBeenCalledWith('presence:7', 1_000_000, 'sock-1');
    expect(multiMock.expire).toHaveBeenCalledWith('presence:7', 30);
  });

  it('removeConnection: чистит stale и возвращает ZCARD', async () => {
    multiMock.exec.mockResolvedValue([
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    await expect(repository.removeConnection(7, 'sock-1')).resolves.toBe(1);
    expect(multiMock.zrem).toHaveBeenCalledWith('presence:7', 'sock-1');
    expect(multiMock.zremrangebyscore).toHaveBeenCalledWith('presence:7', '-inf', 970_000);
    expect(multiMock.zcard).toHaveBeenCalledWith('presence:7');
  });

  it('getOnline: после чистки stale возвращает online по ZCARD', async () => {
    pipelineMock.exec.mockResolvedValue([
      [null, 0],
      [null, 2],
      [null, 1],
      [null, 0],
    ]);

    await expect(repository.getOnline([1, 2])).resolves.toEqual(
      new Map([
        [1, true],
        [2, false],
      ]),
    );
    expect(pipelineMock.zremrangebyscore).toHaveBeenCalledWith('presence:1', '-inf', 970_000);
    expect(pipelineMock.zremrangebyscore).toHaveBeenCalledWith('presence:2', '-inf', 970_000);
  });

  it('getOnline: для пустого списка возвращает пустую Map', async () => {
    await expect(repository.getOnline([])).resolves.toEqual(new Map());
    expect(redisMock.pipeline).not.toHaveBeenCalled();
  });
});
