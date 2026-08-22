import { Test, TestingModule } from '@nestjs/testing';
import { UserPresenceSettings } from '@generated/prisma-messenger';
import { PresenceDisconnectCommand } from '../commands/presence-disconnect.command';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { PresenceDisconnectUseCase } from './presence-disconnect.usecase';

describe('PresenceDisconnectUseCase (unit)', () => {
  let useCase: PresenceDisconnectUseCase;
  let presenceRedisRepositoryMock: jest.Mocked<
    Pick<PresenceRedisRepository, 'removeConnection'>
  >;
  let presenceRepositoryMock: jest.Mocked<
    Pick<PresenceRepository, 'getSettings' | 'updateLastSeen'>
  >;
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T15:00:00.000Z'));

    presenceRedisRepositoryMock = {
      removeConnection: jest.fn().mockResolvedValue(0),
    };
    presenceRepositoryMock = {
      getSettings: jest.fn().mockResolvedValue(settings),
      updateLastSeen: jest.fn().mockResolvedValue(undefined),
    };
    presenceBroadcastHelperMock = {
      emitToPeersWhoShowActivity: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceDisconnectUseCase,
        { provide: PresenceRedisRepository, useValue: presenceRedisRepositoryMock },
        { provide: PresenceRepository, useValue: presenceRepositoryMock },
        { provide: PresenceBroadcastHelper, useValue: presenceBroadcastHelperMock },
      ],
    }).compile();

    useCase = module.get(PresenceDisconnectUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('при уходе offline обновляет lastSeenAt и рассылает presence.updated', async () => {
    await useCase.execute(new PresenceDisconnectCommand({ userId: 1, socketId: 'sock-1' }));

    expect(presenceRedisRepositoryMock.removeConnection).toHaveBeenCalledWith(1, 'sock-1');
    expect(presenceRepositoryMock.updateLastSeen).toHaveBeenCalledWith(
      1,
      new Date('2026-07-19T15:00:00.000Z'),
    );
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).toHaveBeenCalledWith(1, {
      online: false,
      lastSeenAt: '2026-07-19T15:00:00.000Z',
    });
  });

  it('не обновляет lastSeen и не рассылает, если остались сокеты', async () => {
    presenceRedisRepositoryMock.removeConnection.mockResolvedValue(1);

    await useCase.execute(new PresenceDisconnectCommand({ userId: 1, socketId: 'sock-1' }));

    expect(presenceRepositoryMock.updateLastSeen).not.toHaveBeenCalled();
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).not.toHaveBeenCalled();
  });

  it('обновляет lastSeen, но не рассылает при скрытой активности', async () => {
    presenceRepositoryMock.getSettings.mockResolvedValue({
      ...settings,
      showActivityStatus: false,
    });

    await useCase.execute(new PresenceDisconnectCommand({ userId: 1, socketId: 'sock-1' }));

    expect(presenceRepositoryMock.updateLastSeen).toHaveBeenCalled();
    expect(presenceBroadcastHelperMock.emitToPeersWhoShowActivity).not.toHaveBeenCalled();
  });
});
