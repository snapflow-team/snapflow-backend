import { Test, TestingModule } from '@nestjs/testing';
import { UserPresenceSettings } from '@generated/prisma-messenger';
import { UpdateActivityStatusCommand } from '../commands/update-activity-status.command';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { UpdateActivityStatusUseCase } from './update-activity-status.usecase';

describe('UpdateActivityStatusUseCase (unit)', () => {
  let useCase: UpdateActivityStatusUseCase;
  let presenceRepositoryMock: jest.Mocked<
    Pick<PresenceRepository, 'upsertSettings' | 'getSettings'>
  >;
  let presenceRedisRepositoryMock: jest.Mocked<Pick<PresenceRedisRepository, 'getOnline'>>;
  let presenceBroadcastHelperMock: jest.Mocked<
    Pick<PresenceBroadcastHelper, 'emitToPeersWhoShowActivity'>
  >;

  const settings: UserPresenceSettings = {
    userId: 1,
    showActivityStatus: true,
    lastSeenAt: new Date('2026-07-19T10:00:00.000Z'),
    updatedAt: new Date('2026-07-19T12:00:00.000Z'),
  };

  beforeEach(async () => {
    presenceRepositoryMock = {
      upsertSettings: jest.fn().mockResolvedValue(settings),
      getSettings: jest.fn().mockResolvedValue(settings),
    };
    presenceRedisRepositoryMock = {
      getOnline: jest.fn().mockResolvedValue(new Map([[1, false]])),
    };
    presenceBroadcastHelperMock = {
      emitToPeersWhoShowActivity: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateActivityStatusUseCase,
        { provide: PresenceRepository, useValue: presenceRepositoryMock },
        { provide: PresenceRedisRepository, useValue: presenceRedisRepositoryMock },
        { provide: PresenceBroadcastHelper, useValue: presenceBroadcastHelperMock },
      ],
    }).compile();

    useCase = module.get(UpdateActivityStatusUseCase);
  });

  it('при выключении рассылает скрытие статуса', async () => {
    await useCase.execute(
      new UpdateActivityStatusCommand({ userId: 1, showActivityStatus: false }),
    );

    expect(presenceRepositoryMock.upsertSettings).toHaveBeenCalledWith(1, false);
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).toHaveBeenCalledWith(1, {
      online: false,
      lastSeenAt: null,
    });
    expect(presenceRedisRepositoryMock.getOnline).not.toHaveBeenCalled();
  });

  it('при включении рассылает актуальный offline-статус с lastSeenAt', async () => {
    await useCase.execute(new UpdateActivityStatusCommand({ userId: 1, showActivityStatus: true }));

    expect(presenceRepositoryMock.upsertSettings).toHaveBeenCalledWith(1, true);
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).toHaveBeenCalledWith(1, {
      online: false,
      lastSeenAt: '2026-07-19T10:00:00.000Z',
    });
  });

  it('при включении рассылает online без lastSeenAt', async () => {
    presenceRedisRepositoryMock.getOnline.mockResolvedValue(new Map([[1, true]]));

    await useCase.execute(new UpdateActivityStatusCommand({ userId: 1, showActivityStatus: true }));

    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).toHaveBeenCalledWith(1, {
      online: true,
      lastSeenAt: null,
    });
  });
});
