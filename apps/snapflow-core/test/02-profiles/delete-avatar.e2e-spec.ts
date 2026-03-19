import { Server } from 'http';
import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthTestManager } from '../managers/auth.test-manager';
import { AppTestManager } from '../managers/app.test-manager';
import { TestUtils } from '../helpers/test.utils';

import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { FilesClient } from '../../src/modules/integrations/files/files.client';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';

describe('ProfileController - deleteAvatar() (DELETE: /users/profile/avatar)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let deleteFileMock: jest.Mock;
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

    deleteFileMock = jest
      .spyOn(FilesClient.prototype, 'deleteFile')
      .mockResolvedValue({ success: true }) as jest.Mock;

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    deleteFileMock.mockClear();
    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен успешно удалить аватар, затереть ссылку в БД и вызвать микросервис файлов', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const fakeAvatarUrl = `https://s3.domain.com/avatars/${userId}/fake-uuid.png`;

    // 🔻 2. Насильно проставляем аватарку в профиль напрямую через БД
    await appTestManager.prisma.userProfile.updateMany({
      where: { userId },
      data: { avatarUrl: fakeAvatarUrl },
    });

    // 🔻 3. Делаем DELETE запрос (Act)
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 4. Проверяем, что запрос улетел в микросервис файлов
    expect(deleteFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledWith({
      userId,
      fileUrl: fakeAvatarUrl,
    });

    // 🔻 5. Проверяем, что ссылка на аватарку удалена (null) в базе данных
    const profile = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    expect(profile).toBeDefined();
    expect(profile?.avatarUrl).toBeNull();
  });

  it('должен вернуть 204 NO_CONTENT, но НЕ вызывать микросервис файлов, если аватара у пользователя и так не было (идемпотентность)', async () => {
    // 🔻 1. Регистрируем пользователя (у него изначально avatarUrl = null)
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 2. Пытаемся удалить аватар
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 3. Проверяем, что микросервис файлов НЕ дергался, чтобы не тратить ресурсы сети
    expect(deleteFileMock).not.toHaveBeenCalled();
  });

  it('не должен удалять аватар и должен вернуть 401, если accessToken не передан', async () => {
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(deleteFileMock).not.toHaveBeenCalled();
  });

  it('не должен удалять аватар и должен вернуть 401, если accessToken невалиден', async () => {
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(HttpStatus.UNAUTHORIZED);

    expect(deleteFileMock).not.toHaveBeenCalled();
  });

  it('не должен удалять аватар и должен вернуть 401, если accessToken протух', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Ждём 3 секунды, чтобы JWT (который в тестовом моке живет 2 сек) истек
    await TestUtils.delay(3000);

    await request(server)
      .delete(`/${GLOBAL_PREFIX}/users/profile/avatar`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(deleteFileMock).not.toHaveBeenCalled();
  });
});
