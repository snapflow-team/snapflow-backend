import { Test, TestingModule } from '@nestjs/testing';
import { UserPresenceSettings } from '@generated/prisma-messenger';
import { PrismaService } from '../../database/prisma.service';
import { PresenceRepository } from './presence.repository';

describe('PresenceRepository (unit)', () => {
  let repository: PresenceRepository;
  let prismaMock: {
    userPresenceSettings: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const settings: UserPresenceSettings = {
    userId: 1,
    showActivityStatus: true,
    lastSeenAt: new Date('2026-07-19T12:00:00.000Z'),
    updatedAt: new Date('2026-07-19T12:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaMock = {
      userPresenceSettings: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PresenceRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get(PresenceRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getSettings: возвращает настройки пользователя', async () => {
    prismaMock.userPresenceSettings.findUnique.mockResolvedValue(settings);

    await expect(repository.getSettings(1)).resolves.toEqual(settings);
    expect(prismaMock.userPresenceSettings.findUnique).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
  });

  it('getSettingsMap: возвращает Map по userId', async () => {
    prismaMock.userPresenceSettings.findMany.mockResolvedValue([settings]);

    await expect(repository.getSettingsMap([1, 2])).resolves.toEqual(new Map([[1, settings]]));
    expect(prismaMock.userPresenceSettings.findMany).toHaveBeenCalledWith({
      where: { userId: { in: [1, 2] } },
    });
  });

  it('upsertSettings: создаёт/обновляет showActivityStatus', async () => {
    prismaMock.userPresenceSettings.upsert.mockResolvedValue({
      ...settings,
      showActivityStatus: false,
    });

    await expect(repository.upsertSettings(1, false)).resolves.toEqual({
      ...settings,
      showActivityStatus: false,
    });
    expect(prismaMock.userPresenceSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 1 },
      create: { userId: 1, showActivityStatus: false },
      update: { showActivityStatus: false },
    });
  });

  it('updateLastSeen: upsert lastSeenAt', async () => {
    const at = new Date('2026-07-19T15:00:00.000Z');
    prismaMock.userPresenceSettings.upsert.mockResolvedValue({ ...settings, lastSeenAt: at });

    await repository.updateLastSeen(1, at);

    expect(prismaMock.userPresenceSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 1 },
      create: { userId: 1, lastSeenAt: at },
      update: { lastSeenAt: at },
    });
  });
});
