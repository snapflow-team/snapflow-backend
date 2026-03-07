import request, { Response } from 'supertest';
import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { HttpStatus } from '@nestjs/common';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { RegistrationUserInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { AuthTestManager } from '../managers/auth.test-manager';
import { User } from '../../generated/prisma';
import { TestUtils } from '../helpers/test.utils';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { DomainExceptionCode } from '../../../../libs/exceptions/http/domain-exception-codes';
import { ProfileViewDto } from '../../src/modules/user-accounts/users/profile/api/dto/view-dto/profile.view-dto';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { ProfilesRepository } from '../../src/modules/user-accounts/users/profile/infrastructure/profiles.repository';

describe('AuthController - registration() (POST: /auth/registration)', () => {
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

  it('должен быть зарегистрирован, если пользователь отправил правильные данные (логин или адрес электронной почты и пароль)', async () => {
    // 🔻 Создаем тестовые данные для регистрации пользователя
    const [dto]: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);

    // 🔻 Выполняем POST-запрос на регистрацию пользователя
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем созданного пользователя из базы данных
    const users: User[] = await authTestManager.getAll();

    const createdUser: User = users[0];

    if (!createdUser) {
      throw new Error(
        'Test №1: AuthController - registration() (POST: /auth/registration): User not found',
      );
    }

    // 🔸 Проверяем количества созданных пользователей
    expect(users).toHaveLength(1);

    // 🔸 Проверяем корректность создания пользователя и его полей
    expect(typeof createdUser.id).toBe('number');
    expect(new Date(createdUser.createdAt).toString()).not.toBe('Invalid Date');
    expect(createdUser.username).toBe(dto.username);
    expect(createdUser.email).toBe(dto.email);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен регистрировать пользователя в системе, если пользователь отправил более 5 запросов с одного IP на "/регистрация" за последние 10 секунд', async () => {
    // 🔻 Создаем 6 наборов тестовых данных для регистрации
    const dtos: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(6);

    // 🔻 Успешно регистрируем первых 5 пользователей
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/registration`)
        .send(dtos[i])
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Пытаемся зарегистрировать 6-го пользователя и получаем ошибку ограничения
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(dtos[5])
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    // 🔻 Проверяем состояние базы данных после регистрации
    const users: User[] = await authTestManager.getAll();

    // 🔸 Проверяем, что в базе данных ровно 5 пользователей
    expect(users).toHaveLength(5);

    // 🔸 Проверяем корректность вызовов отправки email
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(5);
  });

  it('не следует регистрировать, если пользователь с такими данными уже существует (username)', async () => {
    // 🔻 Регистрируем пользователя через менеджер
    const dtos: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);

    await authTestManager.registration(dtos);

    const [dto] = dtos;

    // 🔻 Пытаемся зарегистрировать нового пользователя с тем же username
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        username: dto.username,
        email: 'newUser@example.com',
        password: 'Qwerty1',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемой ошибки
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'User with this username is already registered',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных изменений не произошло
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(1);

    // 🔸 Проверяем, что email не был отправлен во втором запросе
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не следует регистрировать, если пользователь с такими данными уже существует (email)', async () => {
    // 🔻 Регистрируем пользователя через менеджер
    const dtos: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);

    await authTestManager.registration(dtos);

    const [dto] = dtos;

    // 🔻 Пытаемся зарегистрировать нового пользователя с тем же email
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        username: 'new_user',
        email: dto.email,
        password: 'Qwerty1',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемой ошибки
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'email',
          message: 'User with this email is already registered',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных изменений не произошло
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(1);

    // 🔸 Проверяем, что email не был отправлен во втором запросе
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не следует регистрировать пользователя, если данные в теле запроса неверны (передается пустой объект)', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя без каких-либо данных
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Must be a string',
        },
        {
          field: 'email',
          message:
            'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
        },
        {
          field: 'password',
          message: 'Must be a string',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);
  });

  it('не следует регистрировать пользователя, если данные в теле запроса неверны (username: пустая строка, email: пустая строка, password: пустая строка)', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя с пустыми (пробельными) значениями полей
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        username: '   ',
        email: '   ',
        password: '   ',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации для пустых значений
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Length must be between 6 and 30 characters',
        },
        {
          field: 'email',
          message:
            'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
        },
        {
          field: 'password',
          message: 'Length must be between 6 and 20 characters',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);
  });

  it('не следует регистрировать пользователя, если данные в теле запроса неверны (username: меньше минимальной длины, email: некорректный, password: меньше минимальной длины)', async () => {
    // 🔻 Генерируем случайные значения для полей регистрации, которые не соответствуют требованиям
    const username: string = TestUtils.generateRandomString(5);
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(5);

    // 🔻 Пытаемся зарегистрировать пользователя с некорректными данными
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        username,
        email,
        password,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации с конкретными значениями
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Length must be between 6 and 30 characters',
        },
        {
          field: 'email',
          message:
            'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
        },
        {
          field: 'password',
          message: 'Length must be between 6 and 20 characters',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);
  });

  it('не следует регистрировать пользователя, если данные в теле запроса неверны (username: превышает максимальную длину, адрес email: некорректный, password: превышает максимальную длину)', async () => {
    // 🔻 Генерируем случайные значения для полей регистрации, которые превышают максимально допустимую длину
    const username: string = TestUtils.generateRandomString(31);
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(21);

    // 🔻 Пытаемся зарегистрировать пользователя с некорректными данными
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        username,
        email,
        password,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации с конкретными значениями
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Length must be between 6 and 30 characters',
        },
        {
          field: 'email',
          message:
            'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
        },
        {
          field: 'password',
          message: 'Length must be between 6 and 20 characters',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);
  });

  it('не следует регистрировать пользователя, если данные в теле запроса неверны (username: type number,  email: type number)', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя, передавая числовые значения вместо строк
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login: 123,
        email: 123,
        password: 'Qwerty1',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации типов данных
    expect(resRegistration.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/registration`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'username',
          message: 'Must be a string',
        },
        {
          field: 'email',
          message:
            'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const users: User[] = await authTestManager.getAll();
    expect(users).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);
  });

  // Profile

  it('должен создать пользователя и профиль при успешной регистрации', async () => {
    // 🔻 Создаем тестовые данные для регистрации пользователя
    const [dto]: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);

    // 🔻 Выполняем POST-запрос на регистрацию пользователя
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пользователей из БД
    const users: User[] = await authTestManager.getAll();
    const createdUser: User = users[0];

    if (!createdUser) {
      throw new Error('User not found');
    }

    // 🔸 Проверяем пользователя
    expect(users).toHaveLength(1);
    expect(createdUser.username).toBe(dto.username);
    expect(createdUser.email).toBe(dto.email);

    // 🔻 Получаем профиль пользователя
    const profile: ProfileViewDto = await profileTestManager.findProfileByUserId(createdUser.id);

    if (!profile) {
      throw new Error('Profile was not created');
    }

    // 🔸 Проверяем профиль
    expect(typeof profile.id).toBe('string');
    expect(profile.username).toBe(dto.username);
    expect(profile.firstName).toBeNull();
    expect(profile.lastName).toBeNull();
    expect(profile.city).toBeNull();
    expect(profile.country).toBeNull();
    expect(profile.dateOfBirth).toBeNull();
    expect(profile.aboutMe).toBeNull();
    expect(profile.avatarUrl).toBeNull();
    expect(profile.followersCount).toBe(0);
    expect(profile.followingCount).toBe(0);
    expect(profile.postsCount).toBe(0);

    // 🔸 Проверяем отправку email
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен создавать профиль если регистрация не прошла', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя без данных
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем что профили не созданы
    const profiles = await appTestManager.prisma.userProfile.findMany();
    expect(profiles).toHaveLength(0);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('должен откатить создание пользователя если создание профиля упало (транзакция)', async () => {
    // 🔻 Ломаем создание профиля
    jest
      .spyOn(appTestManager.app.get(ProfilesRepository), 'createProfile')
      .mockRejectedValueOnce(new Error('DB error'));

    const [dto]: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);

    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(dto)
      .expect(HttpStatus.INTERNAL_SERVER_ERROR);

    const users: User[] = await authTestManager.getAll();
    const profiles = await appTestManager.prisma.userProfile.findMany();

    expect(users).toHaveLength(0);
    expect(profiles).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
