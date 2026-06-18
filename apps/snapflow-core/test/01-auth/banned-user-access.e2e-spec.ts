import request, { Response } from 'supertest';
import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import { HttpStatus } from '@nestjs/common';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';

const BAN_REASON = 'Bad behavior';
const BANNED_USER_MESSAGE = `The account has been blocked for the following reason: ${BAN_REASON}`;

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
        banReason: BAN_REASON,
        bannedAt: new Date(),
      },
    });

    const resMe: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(resMe.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/me`,
      method: 'GET',
      message: BANNED_USER_MESSAGE,
      code: SnapFlowDomainExceptionCode.Forbidden,
      extensions: [],
    });
  });

  it('должен отклонять refresh-token для забаненного пользователя', async () => {
    const { refreshToken, createdUser } = await authTestManager.loginAndGetAuthTokens();

    await appTestManager.prisma.user.update({
      where: { id: createdUser.id },
      data: {
        isBanned: true,
        banReason: BAN_REASON,
        bannedAt: new Date(),
      },
    });

    const resRefresh: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(resRefresh.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/refresh-token`,
      method: 'POST',
      message: BANNED_USER_MESSAGE,
      code: SnapFlowDomainExceptionCode.Forbidden,
      extensions: [],
    });
  });
});
