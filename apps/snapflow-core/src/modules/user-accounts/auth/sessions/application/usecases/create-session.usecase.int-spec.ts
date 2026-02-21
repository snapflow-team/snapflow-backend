import { TestingModule } from '@nestjs/testing';
import { Session, User } from '@generated/prisma';
import { PrismaService } from '../../../../../../database/prisma.service';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { parseUserAgent } from '../../../../../../../../../libs/common/utils/user-agent.parser';
import { CreateSessionCommand, CreateSessionUseCase } from './create-session.usecase';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { IntegrationTestModuleHelper } from '../../../../../../../test/helpers/integration-test-module.helper';
import { TestEntityFactory } from '../../../../../../../test/helpers/test-entity.factory';

describe('CreateSessionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateSessionUseCase;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await IntegrationTestModuleHelper.createTestingModule([
      SessionsRepository,
      CreateSessionUseCase,
    ]);

    useCase = module.get<CreateSessionUseCase>(CreateSessionUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await IntegrationTestModuleHelper.close(module, prisma);
  });

  beforeEach(async () => {
    await IntegrationTestModuleHelper.clearAuthSessionsData(prisma);
  });

  it('should persist new session for user with parsed device data', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, {
      suffix: 'create_session',
    });

    const dto: CreateSessionDto = {
      userId: user.id,
      deviceId: 'device-123',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      ip: '127.0.0.1',
      iat: 1735689600,
      exp: 1735693200,
    };

    await useCase.execute(new CreateSessionCommand(dto));

    const createdSession: Session | null = await prisma.session.findFirst({
      where: {
        userId: user.id,
        deviceId: dto.deviceId,
        deletedAt: null,
      },
    });

    expect(createdSession).not.toBeNull();
    expect(createdSession!.userId).toBe(user.id);
    expect(createdSession!.deviceId).toBe(dto.deviceId);
    expect(createdSession!.ip).toBe(dto.ip);
    expect(createdSession!.deviceName).toBe(parseUserAgent(dto.userAgent));
    expect(createdSession!.iat).toEqual(new Date(dto.iat * 1000));
    expect(createdSession!.exp).toEqual(new Date(dto.exp * 1000));
  });
});
