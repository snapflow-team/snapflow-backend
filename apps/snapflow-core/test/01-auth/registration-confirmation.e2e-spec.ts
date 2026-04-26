import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/emails/templates/types';
import { RegistrationEmailResendingInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-email-resending.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { HttpStatus } from '@nestjs/common';
import { RegistrationUserInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { ConfirmationStatus } from '@generated/prisma-snapflow';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { randomUUID } from 'crypto';

describe('AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)', () => {
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

  it('должен подтверждать регистрацию, если передан корректный code', async () => {
    // 🔻 Регистрируем пользователя, чтобы получить confirmation code
    const [dto]: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);
    await authTestManager.registration([dto]);

    const userBefore: UserWithEmailConfirmation | null =
      await authTestManager.findUserWithEmailConfirmationByEmail(dto.email);
    const code = userBefore?.emailConfirmationCode?.confirmationCode;

    // 🔻 Отправляем code на подтверждение регистрации
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code })
      .expect(HttpStatus.NO_CONTENT);

    // 🔸 Проверяем, что статус подтверждения изменился
    const userAfter: UserWithEmailConfirmation | null =
      await authTestManager.findUserWithEmailConfirmationByEmail(dto.email);
    expect(userAfter?.emailConfirmationCode?.confirmationStatus).toBe(ConfirmationStatus.Confirmed);
    expect(userAfter?.emailConfirmationCode?.confirmationCode).toBeNull();
    expect(userAfter?.emailConfirmationCode?.expirationDate).toBeNull();

    // 🔸 Проверяем, что письмо ушло только во время регистрации
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('не должен подтверждать регистрацию, если code не существует в системе', async () => {
    // 🔻 Отправляем валидный UUID, которого нет в БД
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code: randomUUID() })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('не должен подтверждать регистрацию, если code уже был использован', async () => {
    // 🔻 Регистрируем пользователя
    const [dto]: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);
    await authTestManager.registration([dto]);

    const user: UserWithEmailConfirmation | null =
      await authTestManager.findUserWithEmailConfirmationByEmail(dto.email);
    const code = user?.emailConfirmationCode?.confirmationCode;

    // 🔸 Первый запрос успешно подтверждает email
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code })
      .expect(HttpStatus.NO_CONTENT);

    // 🔸 Повторный запрос с тем же code должен вернуть ошибку
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('не должен подтверждать регистрацию, если срок действия code истёк', async () => {
    // 🔻 Регистрируем пользователя
    const [dto]: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);
    await authTestManager.registration([dto]);

    const user: UserWithEmailConfirmation | null =
      await authTestManager.findUserWithEmailConfirmationByEmail(dto.email);

    if (!user?.emailConfirmationCode?.id || !user?.emailConfirmationCode?.confirmationCode) {
      throw new Error('Confirmation code was not created');
    }

    // 🔻 Протухаем код вручную в БД
    await appTestManager.prisma.emailConfirmationCode.update({
      where: { id: user.emailConfirmationCode.id },
      data: {
        expirationDate: new Date(Date.now() - 1000 * 60),
      },
    });

    // 🔻 Проверяем, что endpoint возвращает ошибку
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code: user.emailConfirmationCode.confirmationCode })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('не должен подтверждать регистрацию, если code не передан', async () => {
    // 🔻 Отправляем пустое тело
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('не должен подтверждать регистрацию, если code передан в неверном формате (number)', async () => {
    // 🔻 Отправляем невалидный тип данных
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code: 123456 })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('не должен подтверждать регистрацию, если code передан в неверном формате (не UUID)', async () => {
    // 🔻 Отправляем строку, не соответствующую UUID
    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code: 'not-a-uuid-code' })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что получили ошибку валидации
    expect(res.body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        extensions: expect.any(Array),
      }),
    );
  });

  it('не должен подтверждать регистрацию, если пользователь превысил лимит запросов (более 5 за 10 секунд)', async () => {
    // 🔻 Делаем 5 неуспешных запросов (валидный UUID, но кода нет в БД)
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
        .send({ code: randomUUID() })
        .expect(HttpStatus.BAD_REQUEST);
    }

    // 🔸 6-й запрос должен быть заблокирован по rate limit
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({ code: randomUUID() })
      .expect(HttpStatus.TOO_MANY_REQUESTS);
  });
});
