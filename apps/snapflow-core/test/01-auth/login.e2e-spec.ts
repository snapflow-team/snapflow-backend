import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { HttpStatus } from '@nestjs/common';
import { TestUtils } from '../helpers/test.utils';
import { RegistrationUserInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';

describe('AuthController - login() (POST: /auth/login)', () => {
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

  it('должен быть авторизован, если пользователь отправил правильные данные (email и password) и подтвердил свой email', async () => {
    // 🔻 Создаём нового пользователя с подтверждённым email
    const [user]: UserWithEmailConfirmation[] =
      await authTestManager.registrationWithConfirmation();

    // 🔻 Отправляем корректные email/пароль в запросе на вход
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: user.email,
        password: 'Qwerty_1',
      })
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что в ответе пришёл accessToken
    expect(resLogin.body).toEqual({
      accessToken: expect.any(String),
    });

    // 🔸 Убеждаемся, что в заголовке Set-Cookie содержится refreshToken
    expect(resLogin.headers['set-cookie']).toBeDefined();
    expect(resLogin.headers['set-cookie'][0]).toMatch(/refreshToken=.*;/);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не следует авторизовывать пользователя, если пользователь отправил более 5 запросов с одного IP на "/login" за последние 10 секунд', async () => {
    // 🔻 Создаём пользователя
    const [user]: UserWithEmailConfirmation[] =
      await authTestManager.registrationWithConfirmation();

    // 🔸 Отправляем 5 корректных запросов на вход — все они должны пройти успешно
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .send({
          email: user.email,
          password: 'Qwerty_1',
        })
        .expect(HttpStatus.OK);
    }

    // 🔸 6-й запрос должен быть заблокирован из-за превышения лимита
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: user.email,
        password: 'Qwerty_1',
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не следует авторизовывать пользователя, если пользователь не подтвердил свой email', async () => {
    // 🔻 Создаём пользователя
    const dtos: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);
    await authTestManager.registration(dtos);

    // 🔸 Отправляем запрос на вход — должен быть отклонен из-за неподтвержденного email
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: dtos[0].email,
        password: dtos[0].password,
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не следует выполнять вход, если пользователь отправил неверные данные (username: "undefined", password: "undefined")', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с пустым телом
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({})
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();
  });

  it('не следует выполнять вход, если пользователь отправил неверные данные (email: тип number, password: тип number)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с числовыми значениями email и password
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: 123,
        password: 123,
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();
  });

  it('не следует выполнять вход, если пользователь отправил неверные данные (email: пустая строка, password: пустая строка)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с пустыми строками в полях email и password
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: '   ',
        password: '   ',
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();
  });

  it('не следует выполнять вход, если пользователь отправил неверные данные (email: некорректный, password: превышает максимальную длину)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с email (невалидный) и password (21 символ), превышающими максимальную длину
    const email: string = TestUtils.generateRandomString(120);
    const password: string = TestUtils.generateRandomString(21);

    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email,
        password,
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();
  });

  it('не следует выполнять вход, если пользователь отправил некорректные данные (email: невалидный, password: меньше минимальной длины).', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с email (невалидный) и password (5 символов), не удовлетворяющими минимальной длине
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(5);

    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email,
        password,
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();
  });

  it('не следует выполнять вход, если пользователь отправил некорректные данные (пользователя с таким email не существует)', async () => {
    // 🔻 Создаем несуществующий email
    const email: string = 'example@example.com';

    // 🔻 Создаём одного пользователя с подтверждённым email (для имитации существующих пользователей)
    await authTestManager.registrationWithConfirmation();

    // 🔻 Пытаемся авторизоваться с несуществующим email и корректным паролем
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email,
        password: 'Qwerty_1',
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что refreshToken не установлен в Set-Cookie
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не следует выполнять вход, если пользователь отправил некорректные данные (password: неверный пароль)', async () => {
    // 🔻 Создаём нового пользователя с подтверждённым email
    const [user]: UserWithEmailConfirmation[] =
      await authTestManager.registrationWithConfirmation();

    // 🔻 Отправляем неверный пароль в запросе на вход (при этом email — валидный email пользователя)
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: user.email,
        password: 'Qwerty_2',
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Проверяем, что refreshToken не установлен в заголовках Set-Cookie
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
