import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { AuthTestManager } from '../managers/auth.test-manager';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { AppTestManager } from '../managers/app.test-manager';
import request, { Response } from 'supertest';
import { HttpStatus } from '@nestjs/common';
import {
  UpdateProfileInputDto
} from '../../src/modules/user-accounts/users/profile/api/dto/input-dto/update-profile.input-dto';
import { ProfileViewDto } from '../../src/modules/user-accounts/users/profile/api/dto/view-dto/profile.view-dto';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { TestUtils } from '../helpers/test.utils';
import { DomainExceptionCode } from '../../../../libs/common/exceptions/types/domain-exception-codes';

describe('ProfileController - updateProfile() (PUT: /users/profile)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let profileTestManager: ProfileTestManager;
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

  it('должен успешно обновить профиль (все поля) при валидных данных и корректном accessToken', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const dto: UpdateProfileInputDto = {
      username: 'new_username',
      firstName: 'Alex',
      lastName: 'Smith',
      dateOfBirth: '2000-01-01',
      country: 'Russia',
      city: 'Moscow',
      aboutMe: 'Backend developer',
    };

    // 🔻 Делаем PUT запрос с токеном пользователя
    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Проверяем, что профиль обновился в базе
    const profile: ProfileViewDto = await profileTestManager.findProfileByUserId(userId);
    expect(profile.username).toBe(dto.username);
    expect(profile.firstName).toBe(dto.firstName);
    expect(profile.lastName).toBe(dto.lastName);
    expect(profile.dateOfBirth).toBe(dto.dateOfBirth);
    expect(profile.country).toBe(dto.country);
    expect(profile.city).toBe(dto.city);
    expect(profile.aboutMe).toBe(dto.aboutMe);
  });

  it('должен позволять не передавать опциональные поля (country, city, aboutMe, dateOfBirth)', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const dto: UpdateProfileInputDto = {
      username: 'new_username',
      firstName: 'Bob',
      lastName: 'Johnson',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    const profile: ProfileViewDto = await profileTestManager.findProfileByUserId(userId);
    expect(profile.username).toBe(dto.username);
    expect(profile.firstName).toBe(dto.firstName);
    expect(profile.lastName).toBe(dto.lastName);

    // 🔸 Остальные поля должны остаться неизменными
    expect(profile.dateOfBirth).toBeNull();
    expect(profile.country).toBeNull();
    expect(profile.city).toBeNull();
    expect(profile.aboutMe).toBeNull();
  });

  it('должен обновлять только переданные поля и не трогать остальные', async () => {
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    // сначала создаём профиль с полным набором данных
    const dto: UpdateProfileInputDto = {
      username: 'new_username',
      firstName: 'Alex',
      lastName: 'Smith',
      dateOfBirth: '2000-01-01',
      country: 'Russia',
      city: 'Moscow',
      aboutMe: 'Backend developer',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    const profileBefore: ProfileViewDto = await profileTestManager.findProfileByUserId(userId);

    // теперь обновляем только username и city
    const partial_dto: UpdateProfileInputDto = {
      username: 'updated_name',
      firstName: 'Alex',
      lastName: 'Smith',
      city: 'SPB',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(partial_dto)
      .expect(HttpStatus.NO_CONTENT);

    const profileAfter: ProfileViewDto = await profileTestManager.findProfileByUserId(userId);

    expect(profileAfter?.username).toBe('updated_name');
    expect(profileAfter?.city).toBe('SPB');

    // не должны поменяться:
    expect(profileAfter?.firstName).toBe(profileBefore?.firstName);
    expect(profileAfter?.lastName).toBe(profileBefore?.lastName);
    expect(profileAfter?.country).toBe(profileBefore?.country);
    expect(profileAfter?.aboutMe).toBe(profileBefore?.aboutMe);
    expect(profileAfter?.dateOfBirth).toBe(profileBefore?.dateOfBirth);
  });

  it('не должен обновлять профиль и должен вернуть 401, если accessToken не передан', async () => {
    const dto: UpdateProfileInputDto = {
      username: 'valid_name-01',
      firstName: 'Alex',
      lastName: 'Smith',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .send(dto)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('не должен обновлять профиль и должен вернуть 401, если accessToken невалиден', async () => {
    const dto: UpdateProfileInputDto = {
      username: 'valid_name-01',
      firstName: 'Alex',
      lastName: 'Smith',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', 'invalid.token')
      .send(dto)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('не должен обновлять профиль и должен вернуть 401, если accessToken протух', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    // 🔻 Ждём, пока accessToken протухнет (в соответствии с конфигурацией TTL)
    await TestUtils.delay(3000);

    const dto: UpdateProfileInputDto = {
      username: 'valid_name-01',
      firstName: 'Alex',
      lastName: 'Smith',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('не должен обновлять профиль и должен вернуть 400, если {username: не соответствует паттерну, firstName: не соответствует паттерну, lastName: не соответствует паттерну}', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const dto: UpdateProfileInputDto = {
      username: 'invalid username with spaces',
      firstName: 'firstName-1',
      lastName: 'lastName-1',
    };

    const res: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      path: `/${GLOBAL_PREFIX}/users/profile`,
      method: 'PUT',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message:
            'Username must be 6–30 characters long and contain only letters (a–z, A–Z), digits (0–9), underscore (_) and hyphen (-).',
        },
        {
          field: 'firstName',
          message: 'First name can contain only Latin and Russian letters',
        },
        {
          field: 'lastName',
          message: 'Last name can contain only Latin and Russian letters',
        },
      ],
    });
  });

  it('не должен обновлять профиль и должен вернуть 400, {username: слишком короткий, firstName:слишком короткий, lastName: слишком короткий, country: слишком короткий, city: слишком короткий}', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const dto: UpdateProfileInputDto = {
      username: TestUtils.generateRandomString(5),
      firstName: '',
      lastName: '',
      country: '',
      city: '',
    };

    const res: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      path: `/${GLOBAL_PREFIX}/users/profile`,
      method: 'PUT',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Length must be between 6 and 30 characters',
        },
        {
          field: 'firstName',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'lastName',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'country',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'city',
          message: 'Length must be between 1 and 50 characters',
        },
      ],
    });
  });

  it('не должен обновлять профиль и должен вернуть 400, {username: слишком длинный, firstName:слишком длинный, lastName: слишком длинный, country: слишком длинный, city: слишком длинный, aboutMe: слишком длинный}', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const dto: UpdateProfileInputDto = {
      username: TestUtils.generateRandomString(31),
      firstName: TestUtils.generateRandomString(51),
      lastName: TestUtils.generateRandomString(51),
      country: TestUtils.generateRandomString(51),
      city: TestUtils.generateRandomString(51),
      aboutMe: TestUtils.generateRandomString(201),
    };

    const res: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      path: `/${GLOBAL_PREFIX}/users/profile`,
      method: 'PUT',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Length must be between 6 and 30 characters',
        },
        {
          field: 'firstName',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'lastName',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'country',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'city',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'aboutMe',
          message: 'Length must be between 0 and 200 characters',
        },
      ],
    });
  });

  it('не должен обновлять профиль и должен вернуть 400, {username: состоит из пробелов, firstName: состоит из пробелов, lastName: состоит из пробелов, country: состоит из пробелов, city: состоит из пробелов}', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const dto: UpdateProfileInputDto = {
      username: '      ',
      firstName: ' ',
      lastName: ' ',
      country: ' ',
      city: ' ',
    };

    const res: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      path: `/${GLOBAL_PREFIX}/users/profile`,
      method: 'PUT',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Length must be between 6 and 30 characters',
        },
        {
          field: 'firstName',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'lastName',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'country',
          message: 'Length must be between 1 and 50 characters',
        },
        {
          field: 'city',
          message: 'Length must be between 1 and 50 characters',
        },
      ],
    });
  });

  it('не должен обновлять профиль и должен вернуть 400, {username: содержит числовой тип, firstName: содержит числовой тип, lastName: содержит числовой тип, country: содержит числовой тип, city: содержит числовой тип, aboutMe: содержит числовой тип}', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const dto = {
      username: 123456,
      firstName: 1,
      lastName: 1,
      country: 1,
      city: 1,
      aboutMe: 1,
    };

    const res: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      path: `/${GLOBAL_PREFIX}/users/profile`,
      method: 'PUT',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Must be a string',
        },
        {
          field: 'firstName',
          message: 'Must be a string',
        },
        {
          field: 'lastName',
          message: 'Must be a string',
        },
        {
          field: 'country',
          message: 'Must be a string',
        },
        {
          field: 'city',
          message: 'Must be a string',
        },
        {
          field: 'aboutMe',
          message: 'Must be a string',
        },
      ],
    });
  });

  it('не должен обновлять профиль и должен вернуть 400, если dateOfBirth не является валидной датой', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const dto = {
      username: 'valid_name-01',
      firstName: 'Alex',
      lastName: 'Smith',
      dateOfBirth: 'invalid-date',
    };

    const res: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual({
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      path: `/${GLOBAL_PREFIX}/users/profile`,
      method: 'PUT',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'dateOfBirth',
          message: 'dateOfBirth must be a valid ISO 8601 date string',
        },
      ],
    });
  });

  it('не должен обновлять профиль и должен вернуть 400, если dateOfBirth < 13 лет (бизнес-валидация)', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    const today = new Date();
    const tooYoungYear: number = today.getFullYear() - 10;
    const dob = `${tooYoungYear}-01-01`;

    const dto = {
      username: 'valid_name-01',
      firstName: 'Alex',
      lastName: 'Smith',
      dateOfBirth: dob,
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.BAD_REQUEST);

    const profile: ProfileViewDto = await profileTestManager.findProfileByUserId(userId);
    expect(profile.dateOfBirth).toBeNull();
  });

  it('не должен обновлять профиль и должен вернуть 500, если профиль пользователя отсутствует в БД (инвариант регистрации нарушен)', async () => {
    // 🔻 Регистрируем пользователя для аутентификации
    const {
      accessToken,
      createdUser: { id: userId },
    } = await authTestManager.loginAndGetAuthTokens();

    // вручную удаляем профиль, чтобы смоделировать нарушение инварианта
    await appTestManager.prisma.userProfile.deleteMany({
      where: { userId },
    });

    const dto = {
      username: 'valid_name-01',
      firstName: 'Alex',
      lastName: 'Smith',
    };

    await request(server)
      .put(`/${GLOBAL_PREFIX}/users/profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
