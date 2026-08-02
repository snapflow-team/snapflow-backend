import { Test, TestingModule } from '@nestjs/testing';
import { UserPresenceSettings } from '@generated/prisma-messenger';
import { PresenceConnectCommand } from '../commands/presence-connect.command';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { PresenceConnectUseCase } from './presence-connect.usecase';

describe('PresenceConnectUseCase (unit)', () => {
  let useCase: PresenceConnectUseCase;
  let presenceRedisRepositoryMock: jest.Mocked<
    Pick<PresenceRedisRepository, 'addConnection'>
  >;
  let presenceRepositoryMock: jest.Mocked<Pick<PresenceRepository, 'getSettings'>>;
  let presenceBroadcastHelperMock: jest.Mocked<
    Pick<PresenceBroadcastHelper, 'emitToPeersWhoShowActivity'>
  >;

  const settings: UserPresenceSettings = {
    userId: 1,
    showActivityStatus: true,
    lastSeenAt: null,
    updatedAt: new Date('2026-07-19T12:00:00.000Z'),
  };

  beforeEach(async () => {
    presenceRedisRepositoryMock = {
      addConnection: jest.fn().mockResolvedValue(true),
    };
    presenceRepositoryMock = {
      getSettings: jest.fn().mockResolvedValue(settings),
    };
    presenceBroadcastHelperMock = {
      emitToPeersWhoShowActivity: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceConnectUseCase,
        { provide: PresenceRedisRepository, useValue: presenceRedisRepositoryMock },
        { provide: PresenceRepository, useValue: presenceRepositoryMock },
        { provide: PresenceBroadcastHelper, useValue: presenceBroadcastHelperMock },
      ],
    }).compile();

    useCase = module.get(PresenceConnectUseCase);
  });

  it('при переходе в online рассылает presence.updated', async () => {
    await useCase.execute(new PresenceConnectCommand({ userId: 1, socketId: 'sock-1' }));

    expect(presenceRedisRepositoryMock.addConnection).toHaveBeenCalledWith(1, 'sock-1');
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).toHaveBeenCalledWith(1, {
      online: true,
      lastSeenAt: null,
    });
  });

  it('не рассылает, если пользователь уже был online', async () => {
    presenceRedisRepositoryMock.addConnection.mockResolvedValue(false);

    await useCase.execute(new PresenceConnectCommand({ userId: 1, socketId: 'sock-2' }));

    expect(presenceRepositoryMock.getSettings).not.toHaveBeenCalled();
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).not.toHaveBeenCalled();
  });

  it('не рассылает, если активность скрыта', async () => {
    presenceRepositoryMock.getSettings.mockResolvedValue({
      ...settings,
      showActivityStatus: false,
    });

    await useCase.execute(new PresenceConnectCommand({ userId: 1, socketId: 'sock-1' }));

    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).not.toHaveBeenCalled();
  });

  it('рассылает при отсутствии записи настроек (дефолт show=true)', async () => {
    presenceRepositoryMock.getSettings.mockResolvedValue(null);

    await useCase.execute(new PresenceConnectCommand({ userId: 1, socketId: 'sock-1' }));

    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).toHaveBeenCalledWith(1, {
      online: true,
      lastSeenAt: null,
    });
  });
});
