import { Test, TestingModule } from '@nestjs/testing';
import { Session, User } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../../../database/prisma.service';
import { parseUserAgentDetails } from '../../../../../../../../../libs/common/utils/user-agent.parser';
import { CreateSessionCommand, CreateSessionUseCase } from './create-session.usecase';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { TestEntityFactory } from '../../../../../../../test/helpers/test-entity.factory';
import { SnapflowCoreModule } from '../../../../../../snapflow-core.module';

describe('CreateSessionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateSessionUseCase;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [SnapflowCoreModule],
    }).compile();

    useCase = module.get(CreateSessionUseCase);
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
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
    const parsedUserAgentDetails = parseUserAgentDetails(dto.userAgent);
    expect(createdSession!.browserName).toBe(parsedUserAgentDetails.browserName);
    expect(createdSession!.browserVersion).toBe(parsedUserAgentDetails.browserVersion);
    expect(createdSession!.osName).toBe(parsedUserAgentDetails.osName);
    expect(createdSession!.osVersion).toBe(parsedUserAgentDetails.osVersion);
    expect(createdSession!.deviceName).toBe(parsedUserAgentDetails.deviceName);
    expect(createdSession!.deviceType).toBe(parsedUserAgentDetails.deviceType);
    expect(createdSession!.iat).toEqual(new Date(dto.iat * 1000));
    expect(createdSession!.exp).toEqual(new Date(dto.exp * 1000));
  });
});
