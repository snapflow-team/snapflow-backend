import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { HttpStatus } from '@nestjs/common';
import { Session } from '@generated/prisma';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { TestUtils } from '../helpers/test.utils';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { DomainExceptionCode } from '../../../../libs/common/exceptions/types/domain-exception-codes';
import { ErrorResponseDto } from '../../../../libs/common/exceptions/dto/error-response-body.dto';

describe('AuthController - logout() (POST: /auth/logout)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.refreshTokenSecret,
            signOptions: { expiresIn: '3s' },
          });
        },
        inject: [UserAccountsConfig],
      }),
    );

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

  it('должен успешно разлогинить пользователя и очистить refreshToken cookie при валидном JWT refresh и сессии в БД', async () => {
    const { refreshToken } = await authTestManager.loginAndGetAuthTokens();

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // проверяем, что в ответе нет тела
    expect(resLogout.body).toEqual({});

    // проверяем, что в Set-Cookie уходит clear-cookie для refreshToken
    expect(resLogout.headers['set-cookie']).toBeDefined();

    const cookie: string = resLogout.headers['set-cookie'][0];
    expect(cookie).toMatch(/refreshToken=/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);

    // проверяем, что сессия помечена как удалённая в БД
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: { not: null } },
    });

    expect(sessions.length).toBe(1);
    expect(sessions[0].deviceId).toBeDefined();
  });

  it('не должен разлогинить пользователя, если refreshToken отсутствует в cookies', async () => {
    await authTestManager.loginAndGetAuthTokens();

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });

    // проверяем, что сессия осталась живой
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: null },
    });

    expect(sessions.length).toBe(1);
  });

  it('не должен разлогинить пользователя, если refreshToken невалиден (битый токен)', async () => {
    await authTestManager.loginAndGetAuthTokens();

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=invalid.token.here`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });

    // проверяем, что сессия осталась живой
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: null },
    });

    expect(sessions.length).toBe(1);
  });

  it('не должен разлогинить пользователя, если refreshToken просрочен', async () => {
    const { refreshToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Ждём 3 секунды — предполагаем, что Refresh токен за это время успеет истечь
    await TestUtils.delay(3000);

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });

    // проверяем, что сессия осталась живой
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: null },
    });

    expect(sessions.length).toBe(1);
  });

  it('не должен разлогинить пользователя, если в БД нет активной сессии с таким deviceId', async () => {
    const { refreshToken } = await authTestManager.loginAndGetAuthTokens();

    // эмулируем отсутствие сессии в БД
    jest.spyOn(appTestManager.prisma.session, 'findFirst').mockResolvedValueOnce(null);

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });

    // проверяем, что сессия осталась живой
    const deletedSessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: { not: null } },
    });

    expect(deletedSessions.length).toBe(0);
  });

  it('не должен разлогинить пользователя, если refreshToken передан в заголовке вместо cookie', async () => {
    const { refreshToken } = await authTestManager.loginAndGetAuthTokens();

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Authorization', `Bearer ${refreshToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });

    // проверяем, что сессия осталась живой
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: null },
    });

    expect(sessions.length).toBe(1);
  });

  it('не должен разлогинить пользователя, если refreshToken передан в query‑параметре', async () => {
    const { refreshToken } = await authTestManager.loginAndGetAuthTokens();

    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout?refreshToken=${refreshToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout?refreshToken=${refreshToken}`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });

    // проверяем, что сессия осталась живой
    const sessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: null },
    });

    expect(sessions.length).toBe(1);
  });

  it('не должен разлогинить пользователя, если refreshToken был уже однажды использован и сессия уже удалена', async () => {
    const { refreshToken } = await authTestManager.loginAndGetAuthTokens();

    // первый logout
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // проверяем, что сессия уже помечена как удалённая
    const deletedSessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: { not: null } },
    });

    expect(deletedSessions.length).toBe(1);

    // второй logout с тем же refreshToken
    const resLogout: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(resLogout.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/logout`,
      method: 'POST',
      message: 'User is not authenticated',
      code: DomainExceptionCode.Unauthorized,
      extensions: [],
    });
  });

  it('должен корректно обработать ситуацию, когда в БД несколько сессий, но logout удаляет только текущую по deviceId', async () => {
    const [user]: UserWithEmailConfirmation[] =
      await authTestManager.registrationWithConfirmation();

    await appTestManager.prisma.session.create({
      data: {
        userId: user.id,
        deviceId: 'device-2',
        deviceName: 'test-device-2',
        ip: '127.0.0.1',
        exp: new Date(Date.now() + 3600_000).toISOString(),
        iat: new Date().toISOString(),
        deletedAt: null,
      },
    });

    // логинимся с device-1, получаем refreshToken для неё
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: user.email,
        password: 'Qwerty_1',
      })
      .expect(HttpStatus.OK);

    const cookie: string = resLogin.headers['set-cookie'][0];
    const refreshToken: string | undefined = cookie.match(/refreshToken=([^;]+)/)?.[1];

    // делаем logout с этим refreshToken (device-1)
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', `refreshToken=${refreshToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // проверяем: сессия device-1 удалена, device-2 — нет
    const activeSessions: Session[] = await appTestManager.prisma.session.findMany({
      where: { deletedAt: null },
    });

    expect(activeSessions.length).toBe(1);
    expect(activeSessions[0].deviceId).toBe('device-2');
  });
});
