import request, { Response } from 'supertest';
import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import { HttpStatus } from '@nestjs/common';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';

describe('AuthController - banned user access restrictions', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();
    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен отклонять доступ к /auth/me для забаненного пользователя', async () => {
    const { accessToken, createdUser } = await authTestManager.loginAndGetAuthTokens();

    await appTestManager.prisma.user.update({
      where: { id: createdUser.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const resMe: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resMe.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/me`,
      method: 'GET',
      message: 'User is not authenticated',
      code: SnapFlowDomainExceptionCode.Unauthorized,
      extensions: [],
    });
  });

  it('должен отклонять refresh-token для забаненного пользователя', async () => {
    const { refreshToken, createdUser } = await authTestManager.loginAndGetAuthTokens();

    await appTestManager.prisma.user.update({
      where: { id: createdUser.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const resRefresh: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resRefresh.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/refresh-token`,
      method: 'POST',
      message: 'User is not authenticated',
      code: SnapFlowDomainExceptionCode.Unauthorized,
      extensions: [],
    });
  });
});
