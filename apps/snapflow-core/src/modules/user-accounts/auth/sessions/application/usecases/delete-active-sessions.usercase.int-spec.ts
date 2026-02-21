import { TestingModule } from '@nestjs/testing';
import {
  DeleteActiveSessionsCommand,
  DeleteActiveSessionsUseCase,
} from './delete-active-sessions.usercase';
import { PrismaService } from '../../../../../../database/prisma.service';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { Session } from '@generated/prisma';
import { IntegrationTestModuleHelper } from '../../../../../../../test/helpers/integration-test-module.helper';
import { TestEntityFactory } from '../../../../../../../test/helpers/test-entity.factory';

describe('DeleteActiveSessionsUseCase (Интеграция)', () => {
  let module: TestingModule;
  let useCase: DeleteActiveSessionsUseCase;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await IntegrationTestModuleHelper.createTestingModule([
      SessionsRepository,
      DeleteActiveSessionsUseCase,
    ]);

    useCase = module.get<DeleteActiveSessionsUseCase>(DeleteActiveSessionsUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await IntegrationTestModuleHelper.close(module, prisma);
  });

  beforeEach(async () => {
    await IntegrationTestModuleHelper.clearAuthSessionsData(prisma);
  });

  const createSession = async (params: {
    userId: number;
    deviceId: string;
    deletedAt?: Date | null;
  }): Promise<Session> => {
    return prisma.session.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        deviceName: 'Test Device',
        ip: '127.0.0.1',
        iat: new Date(),
        exp: new Date(Date.now() + 1000 * 60 * 60),
        deletedAt: params.deletedAt ?? null,
      },
    });
  };

  it('должен soft-delete всех активных сессий пользователя, кроме текущего устройства', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'main' });
    const anotherUser = await TestEntityFactory.createTestUser(prisma, { suffix: 'another' });

    const currentSession = await createSession({ userId: user.id, deviceId: 'current-device' });
    const activeSession1 = await createSession({ userId: user.id, deviceId: 'device-1' });
    const activeSession2 = await createSession({ userId: user.id, deviceId: 'device-2' });
    const oldDeletedAt = new Date(Date.now() - 1000 * 60 * 60);
    const alreadyDeleted = await createSession({
      userId: user.id,
      deviceId: 'already-deleted',
      deletedAt: oldDeletedAt,
    });
    const foreignUserSession = await createSession({
      userId: anotherUser.id,
      deviceId: 'foreign-device',
    });

    await useCase.execute(
      new DeleteActiveSessionsCommand({
        userId: user.id,
        deviceId: currentSession.deviceId,
      }),
    );

    const currentInDb = await prisma.session.findUnique({ where: { id: currentSession.id } });
    const active1InDb = await prisma.session.findUnique({ where: { id: activeSession1.id } });
    const active2InDb = await prisma.session.findUnique({ where: { id: activeSession2.id } });
    const alreadyDeletedInDb = await prisma.session.findUnique({
      where: { id: alreadyDeleted.id },
    });
    const foreignInDb = await prisma.session.findUnique({ where: { id: foreignUserSession.id } });

    expect(currentInDb).not.toBeNull();
    expect(currentInDb!.deletedAt).toBeNull();

    expect(active1InDb).not.toBeNull();
    expect(active1InDb!.deletedAt).toEqual(expect.any(Date));
    expect(active2InDb).not.toBeNull();
    expect(active2InDb!.deletedAt).toEqual(expect.any(Date));

    expect(alreadyDeletedInDb).not.toBeNull();
    expect(alreadyDeletedInDb!.deletedAt).toEqual(oldDeletedAt);

    expect(foreignInDb).not.toBeNull();
    expect(foreignInDb!.deletedAt).toBeNull();
  });

  it('не должен удалять ничего, если у пользователя только текущая активная сессия', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'single' });
    const currentSession = await createSession({ userId: user.id, deviceId: 'current-only' });

    await useCase.execute(
      new DeleteActiveSessionsCommand({
        userId: user.id,
        deviceId: currentSession.deviceId,
      }),
    );

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(currentSession.id);
    expect(sessions[0].deletedAt).toBeNull();
  });
});
