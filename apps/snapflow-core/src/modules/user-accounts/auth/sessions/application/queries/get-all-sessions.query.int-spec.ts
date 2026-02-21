import { TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../../../database/prisma.service';
import { IntegrationTestModuleHelper } from '../../../../../../../test/helpers/integration-test-module.helper';
import { User } from '@generated/prisma';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { CreateSessionCommand, CreateSessionUseCase } from '../usecases/create-session.usecase';
import { GetAllSessionsQuery, GetAllSessionsQueryHandler } from './get-all-sessions.query';
import { SessionQueryRepository } from '../../infrastructure/session.query-repository';
import { TestEntityFactory } from '../../../../../../../test/helpers/test-entity.factory';

describe('GetAllSessionsQueryHandler (Интеграция)', () => {
  let module: TestingModule;
  let queryHandler: GetAllSessionsQueryHandler;
  let createSessionUseCase: CreateSessionUseCase;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await IntegrationTestModuleHelper.createTestingModule([
      SessionsRepository,
      SessionQueryRepository,
      CreateSessionUseCase,
      GetAllSessionsQueryHandler,
    ]);

    createSessionUseCase = module.get<CreateSessionUseCase>(CreateSessionUseCase);
    queryHandler = module.get<GetAllSessionsQueryHandler>(GetAllSessionsQueryHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await IntegrationTestModuleHelper.close(module, prisma);
  });

  beforeEach(async () => {
    await IntegrationTestModuleHelper.clearAuthSessionsData(prisma);
  });

  it('должен возвращать только активные сессии текущего пользователя', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'main' });
    const anotherUser: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'other' });

    await createSessionUseCase.execute(
      new CreateSessionCommand({
        userId: user.id,
        deviceId: 'device-1',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        ip: '127.0.0.1',
        iat: 1735689600,
        exp: 1735693200,
      }),
    );

    await createSessionUseCase.execute(
      new CreateSessionCommand({
        userId: user.id,
        deviceId: 'device-2',
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ip: '127.0.0.2',
        iat: 1735689700,
        exp: 1735693300,
      }),
    );

    await createSessionUseCase.execute(
      new CreateSessionCommand({
        userId: user.id,
        deviceId: 'device-soft-deleted',
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        ip: '127.0.0.3',
        iat: 1735689800,
        exp: 1735693400,
      }),
    );

    await createSessionUseCase.execute(
      new CreateSessionCommand({
        userId: anotherUser.id,
        deviceId: 'foreign-device',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        ip: '127.0.0.4',
        iat: 1735689900,
        exp: 1735693500,
      }),
    );

    const softDeleted = await prisma.session.findFirst({
      where: { userId: user.id, deviceId: 'device-soft-deleted', deletedAt: null },
    });
    expect(softDeleted).not.toBeNull();

    await prisma.session.update({
      where: { id: softDeleted!.id },
      data: { deletedAt: new Date() },
    });

    const result = await queryHandler.execute(new GetAllSessionsQuery(user.id));

    expect(result).toHaveLength(2);
    expect(result.map((x) => x.deviceId).sort()).toEqual(['device-1', 'device-2']);
    expect(result.every((x) => x.ip.startsWith('127.0.0.'))).toBe(true);
  });
});
