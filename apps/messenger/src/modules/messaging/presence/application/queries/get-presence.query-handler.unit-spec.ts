import { Test, TestingModule } from '@nestjs/testing';
import { UserPresenceSettings } from '@generated/prisma-messenger';
import { GetPresenceQuery, GetPresenceQueryHandler } from './get-presence.query-handler';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';

describe('GetPresenceQueryHandler (unit)', () => {
  let handler: GetPresenceQueryHandler;
  let presenceRedisRepositoryMock: jest.Mocked<Pick<PresenceRedisRepository, 'getOnline'>>;
  let presenceRepositoryMock: jest.Mocked<Pick<PresenceRepository, 'getSettingsMap'>>;

  const settings = (
    userId: number,
    showActivityStatus: boolean,
    lastSeenAt: Date | null = null,
  ): UserPresenceSettings => ({
    userId,
    showActivityStatus,
    lastSeenAt,
    updatedAt: new Date('2026-07-19T12:00:00.000Z'),
  });

  beforeEach(async () => {
    presenceRedisRepositoryMock = {
      getOnline: jest.fn().mockResolvedValue(
        new Map([
          [2, true],
          [3, false],
          [4, true],
        ]),
      ),
    };
    presenceRepositoryMock = {
      getSettingsMap: jest.fn().mockResolvedValue(
        new Map([
          [1, settings(1, true)],
          [2, settings(2, true)],
          [3, settings(3, true, new Date('2026-07-19T11:00:00.000Z'))],
          [4, settings(4, false)],
        ]),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPresenceQueryHandler,
        { provide: PresenceRedisRepository, useValue: presenceRedisRepositoryMock },
        { provide: PresenceRepository, useValue: presenceRepositoryMock },
      ],
    }).compile();

    handler = module.get(GetPresenceQueryHandler);
  });

  it('возвращает online/lastSeenAt при взаимной видимости', async () => {
    const result = await handler.execute(new GetPresenceQuery(1, [2, 3]));

    expect(result).toEqual([
      { userId: '2', online: true, lastSeenAt: null },
      { userId: '3', online: false, lastSeenAt: '2026-07-19T11:00:00.000Z' },
    ]);
  });

  it('скрывает статус цели, если цель скрыла активность', async () => {
    const result = await handler.execute(new GetPresenceQuery(1, [4]));

    expect(result).toEqual([{ userId: '4', online: false, lastSeenAt: null }]);
  });

  it('скрывает чужие статусы, если запрашивающий скрыл активность', async () => {
    presenceRepositoryMock.getSettingsMap.mockResolvedValue(
      new Map([
        [1, settings(1, false)],
        [2, settings(2, true)],
      ]),
    );

    const result = await handler.execute(new GetPresenceQuery(1, [2]));

    expect(result).toEqual([{ userId: '2', online: false, lastSeenAt: null }]);
  });

  it('дедуплицирует userIds и возвращает пустой массив для пустого батча', async () => {
    expect(await handler.execute(new GetPresenceQuery(1, []))).toEqual([]);

    presenceRedisRepositoryMock.getOnline.mockResolvedValue(new Map([[2, true]]));
    presenceRepositoryMock.getSettingsMap.mockResolvedValue(
      new Map([
        [1, settings(1, true)],
        [2, settings(2, true)],
      ]),
    );

    const result = await handler.execute(new GetPresenceQuery(1, [2, 2]));

    expect(presenceRedisRepositoryMock.getOnline).toHaveBeenCalledWith([2]);
    expect(result).toEqual([{ userId: '2', online: true, lastSeenAt: null }]);
  });
});
