import request, { Response } from 'supertest';
import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { TestUtils } from '../helpers/test.utils';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { AuthTestManager } from '../managers/auth.test-manager';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

describe('AuthController - me() (POST: /auth/me)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.accessTokenSecret,
            signOptions: { expiresIn: '2s' },
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

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен возвращать информацию о пользователе, если пользователь вошел в систему (отправляет действительный токен доступа)', async () => {
    // 🔻 Создаём нового пользователя
    const {
      accessToken,
      createdUser: { id, email, username },
    } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Отправляем GET-запрос на /auth/me с заголовком Authorization
    const resMe: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что тело ответа содержит корректную информацию о пользователе
    expect(resMe.body).toEqual(
      expect.objectContaining({
        userId: id.toString(),
        email,
        username,
      }),
    );

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('должен возвращать ошибку 401, если пользователь не авторизован (отправляет недопустимый токен доступа)', async () => {
    // 🔻 Создаём нового пользователя
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Ждём, пока accessToken протухнет (в соответствии с конфигурацией TTL)
    await TestUtils.delay(3000);

    // 🔻 Отправляем GET-запрос на /auth/me с протухшим access-токеном
    await request(server)
      .get(`/${GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
