import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../../../database/prisma.service';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import {
  DeleteSessionByDeviceIdCommand,
  DeleteSessionByDeviceUseCase,
} from './delete-session-by-device-id.usecase';
import { Session } from '@generated/prisma';
import { IntegrationTestModuleHelper } from '../../../../../../../test/helpers/integration-test-module.helper';
import { DomainExceptionCode } from '../../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { TestEntityFactory } from '../../../../../../../test/helpers/test-entity.factory';

describe('DeleteSessionByDeviceUseCase (Интеграция)', () => {
  let module: TestingModule;
  let useCase: DeleteSessionByDeviceUseCase;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await IntegrationTestModuleHelper.createTestingModule([
      SessionsRepository,
      DeleteSessionByDeviceUseCase,
    ]);

    useCase = module.get<DeleteSessionByDeviceUseCase>(DeleteSessionByDeviceUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await IntegrationTestModuleHelper.close(module, prisma);
  });

  beforeEach(async () => {
    await IntegrationTestModuleHelper.clearAuthSessionsData(prisma);
  });

  const createSession = async (params: { userId: number; deviceId: string }): Promise<Session> => {
    return prisma.session.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        deviceName: 'Test Device',
        ip: '127.0.0.1',
        iat: new Date(),
        exp: new Date(Date.now() + 1000 * 60 * 60),
      },
    });
  };

  it('должен soft-delete сессию по deviceId, если она принадлежит пользователю', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'owner' });
    const targetSession = await createSession({ userId: user.id, deviceId: 'target-device' });

    await useCase.execute(
      new DeleteSessionByDeviceIdCommand(targetSession.deviceId, {
        userId: user.id,
        deviceId: 'current-device',
      }),
    );

    const sessionInDb = await prisma.session.findUnique({ where: { id: targetSession.id } });

    expect(sessionInDb).not.toBeNull();
    expect(sessionInDb!.deletedAt).toEqual(expect.any(Date));
  });

  it('должен выбрасывать BadRequest, если пытаются удалить текущую сессию', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'self' });

    await expect(
      useCase.execute(
        new DeleteSessionByDeviceIdCommand('current-device', {
          userId: user.id,
          deviceId: 'current-device',
        }),
      ),
    ).rejects.toMatchObject({
      code: DomainExceptionCode.BadRequest,
    });
  });

  it('должен выбрасывать NotFound, если сессия по deviceId не найдена', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'missing' });

    await expect(
      useCase.execute(
        new DeleteSessionByDeviceIdCommand('unknown-device', {
          userId: user.id,
          deviceId: 'current-device',
        }),
      ),
    ).rejects.toMatchObject({
      code: DomainExceptionCode.NotFound,
    });
  });

  it('должен выбрасывать Forbidden, если сессия принадлежит другому пользователю', async () => {
    const owner = await TestEntityFactory.createTestUser(prisma, { suffix: 'owner2' });
    const intruder = await TestEntityFactory.createTestUser(prisma, { suffix: 'intruder' });
    const ownerSession = await createSession({ userId: owner.id, deviceId: 'owner-device' });

    await expect(
      useCase.execute(
        new DeleteSessionByDeviceIdCommand(ownerSession.deviceId, {
          userId: intruder.id,
          deviceId: 'intruder-current-device',
        }),
      ),
    ).rejects.toMatchObject({
      code: DomainExceptionCode.Forbidden,
    });

    const sessionInDb = await prisma.session.findUnique({ where: { id: ownerSession.id } });
    expect(sessionInDb).not.toBeNull();
    expect(sessionInDb!.deletedAt).toBeNull();
  });
});
