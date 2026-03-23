import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { AuthTestManager } from '../managers/auth.test-manager';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { AppTestManager } from '../managers/app.test-manager';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { ProfileViewDto } from '../../src/modules/user-accounts/users/profile/api/dto/view-dto/profile.view-dto';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { JwtService } from '@nestjs/jwt';
import { TestUtils } from '../helpers/test.utils';
import { UserProfile } from '@generated/prisma-snapflow';
import { ApiSettings } from '../../src/setup/configuration/api-settings';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../src/setup/configuration/configuration';

describe('ProfileController - getProfile() (GET: /users/profile)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let profileTestManager: ProfileTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (configService: ConfigService<Configuration, true>) => {
          const {
            accessToken: { secret },
          } = configService.get<ApiSettings>('apiSettings').getJwtOptions();

          return new JwtService({
            secret,
            signOptions: { expiresIn: '2s' },
          });
        },
        inject: [ConfigService],
      }),
    );

    server = appTestManager.getServer();

    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    profileTestManager = new ProfileTestManager(appTestManager.prisma, server);

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

  it('должен вернуть профиль пользователя если пользователь авторизован (200)', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { username },
    } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Делаем запрос на получение профиля
    const { body }: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем структуру ответа
    expect(body).toEqual<ProfileViewDto>({
      id: expect.any(String),
      username: username,
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      country: null,
      city: null,
      avatarUrl: null,
      aboutMe: null,
    });
  });

  it('не должен вернуть профиль если accessToken не передан', async () => {
    // 🔻 Делаем запрос на получение профиля
    await request(server).get(`/${GLOBAL_PREFIX}/users/profile`).expect(HttpStatus.UNAUTHORIZED);
  });

  it('не должен вернуть профиль и должен вернуть 401, если accessToken невалиден', async () => {
    // 🔻 Делаем запрос на получение профиля
    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('не должен вернуть профиль и должен вернуть 401, если accessToken протух', async () => {
    // 🔻 1. Регистрируем пользователя
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Ждём 3 секунды, чтобы JWT (который в тестовом моке живет 2 сек) истек
    await TestUtils.delay(3000);

    // 🔻 Делаем запрос на получение профиля
    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 404 если профиль soft-deleted', async () => {
    // 🔻 1. Регистрируем пользователя
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Получаем профиль по userId
    const profile: UserProfile | null = await appTestManager.prisma.userProfile.findFirst({
      where: { userId },
    });

    // 🔻 Мягко удаляем профиль
    await appTestManager.prisma.userProfile.update({
      where: { id: profile!.id },
      data: { deletedAt: new Date() },
    });

    // 🔻 Запрашиваем профиль
    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('должен вернуть актуальные данные профиля после обновления', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Обновляем профиль
    const updateDto = {
      username: 'updatedUsername',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2000-01-01',
      country: 'Germany',
      city: 'Berlin',
      aboutMe: 'Backend developer',
    };

    await profileTestManager.updateProfile(accessToken, updateDto);

    // 🔻 Получаем профиль
    const response: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем что данные обновились
    expect(response.body.username).toBe(updateDto.username);
    expect(response.body.firstName).toBe(updateDto.firstName);
    expect(response.body.lastName).toBe(updateDto.lastName);
    expect(response.body.aboutMe).toBe(updateDto.aboutMe);
    expect(response.body.dateOfBirth).toBe(updateDto.dateOfBirth);
    expect(response.body.country).toBe(updateDto.country);
    expect(response.body.city).toBe(updateDto.city);
  });
});
