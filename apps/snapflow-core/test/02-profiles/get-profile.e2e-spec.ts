import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { AuthTestManager } from '../managers/auth.test-manager';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { AppTestManager } from '../managers/app.test-manager';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { User } from '@generated/prisma';
import { DomainExceptionCode } from '../../../../libs/common/exceptions/types/domain-exception-codes';

describe('ProfileController - getProfile() (GET: /users/profile/:userId)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let profileTestManager: ProfileTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

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

  it('должен вернуть профиль пользователя по userId (200)', async () => {
    // 🔻 Создаем пользователя через фабрику (как в registration.e2e)
    const [registrationDto] = TestDtoFactory.generateRegistrationUserInputDto(1);

    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(registrationDto)
      .expect(HttpStatus.NO_CONTENT);

    const [user]: User[] = await authTestManager.getAll();

    // 🔻 Получаем профиль напрямую из БД (он создается при регистрации)
    const profile = await appTestManager.prisma.userProfile.findFirst({
      where: { userId: user.id },
    });

    expect(profile).toBeTruthy();

    // 🔻 Делаем запрос на получение профиля
    const { body }: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${user.id}`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем структуру ответа
    expect(body).toEqual({
      id: profile!.id.toString(),
      username: profile!.username,
      firstName: profile!.firstName,
      lastName: profile!.lastName,
      dateOfBirth: null,
      country: profile!.country,
      city: profile!.city,
      avatarUrl: profile!.avatarUrl,
      aboutMe: profile!.aboutMe,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
    });
  });

  it('должен вернуть 404 если пользователь не существует', async () => {
    // 🔻 Используем несуществующий userId
    const nonExistingUserId = 999999;

    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${nonExistingUserId}`)
      .expect(HttpStatus.NOT_FOUND);

    // 🔸 Проверяем структуру ошибки
    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/profile/999999`,
      method: 'GET',
      extensions: [],
      message: `The user with ID (${nonExistingUserId}) does not exist`,
      code: DomainExceptionCode.NotFound,
    });
  });

  it('должен вернуть 404 если профиль soft-deleted', async () => {
    // 🔻 Регистрируем пользователя
    await authTestManager.registration();

    const [user]: User[] = await authTestManager.getAll();

    // 🔻 Получаем профиль по userId
    const profile = await appTestManager.prisma.userProfile.findFirst({
      where: { userId: user.id },
    });

    // 🔻 Мягко удаляем профиль
    await appTestManager.prisma.userProfile.update({
      where: { id: profile!.id },
      data: { deletedAt: new Date() },
    });

    // 🔻 Запрашиваем профиль
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${user.id}`)
      .expect(HttpStatus.NOT_FOUND);

    // 🔸 Проверяем сообщение
    expect(res.body.code).toBe(DomainExceptionCode.NotFound);
  });

  it('должен вернуть 400 если userId не число (ParseIntPipe)', async () => {
    // 🔻 Передаем строку вместо числа
    await request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/not-a-number`)
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('должен вернуть актуальные данные профиля после обновления', async () => {
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

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
      .get(`/${GLOBAL_PREFIX}/users/profile/${userId}`)
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
