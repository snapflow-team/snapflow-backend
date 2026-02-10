import { AppTestManager } from '../managers/app.test-manager';
import { Server } from 'http';
import { AuthTestManager } from '../managers/auth.test-manager';
import { CryptoService } from '../../../../libs/common/services/crypto.service';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import {
  RegistrationUserInputDto
} from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { ErrorResponseDto } from '../../../../libs/common/exceptions/dto/error-response-body.dto';
import { DomainExceptionCode } from '../../../../libs/common/exceptions/types/domain-exception-codes';

describe('AuthController - checkPasswordRecoveryCode() (POST: /auth/check-password-recovery-code)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;
  let spyGenerateUUID: jest.SpyInstance<string, []>;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    authTestManager = new AuthTestManager(appTestManager.prisma, server);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;

    spyGenerateUUID = jest.spyOn(CryptoService.prototype, 'generateUUID');
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();

    spyGenerateUUID.mockRestore();
  });

  it('должен вернуть 204, если код восстановления пароля валиден', async () => {
    // 🔻 Генерируем данные для регистрации одного пользователя
    const dtos: RegistrationUserInputDto[] = TestDtoFactory.generateRegistrationUserInputDto(1);

    // 🔻 Регистрируем пользователя через AuthTestManager
    await authTestManager.registration(dtos);

    // 🔻 Инициируем процесс восстановления пароля (будет вызван generateUUID)
    await authTestManager.passwordRecovery(dtos[0].email);

    // 🔸 Берем реально сгенерированный код восстановления из шпиона generateUUID
    const recoveryCode = spyGenerateUUID.mock.results[1].value;

    // 🔻 Выполняем POST-запрос на проверку recoveryCode
    const resCheckPasswordRecoveryCode: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/check-password-recovery-code`)
      .send({ recoveryCode })
      .expect(HttpStatus.NO_CONTENT);

    expect(resCheckPasswordRecoveryCode.body).toEqual({});

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it.only('должен вернуть 400, если код восстановления не валидный', async () => {
    // 🔻 Попытка проверки несуществующего UUID
    const invalidCode = '00000000-0000-0000-0000-000000000000';

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/check-password-recovery-code`)
      .send({ recoveryCode: invalidCode })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации
    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/auth/check-password-recovery-code`,
      method: 'POST',
      message: 'Validation failed',
      code: DomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'recoveryCode',
          message: 'Invalid recovery code',
        },
      ],
    });
  });
});
