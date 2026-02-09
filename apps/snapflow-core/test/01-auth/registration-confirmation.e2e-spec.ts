import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { Server } from 'http';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { RegistrationEmailResendingInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-email-resending.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { RegistrationUserInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { ConfirmationStatus } from '@generated/prisma';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';

describe('AuthController registratinEmailResending POST: /auth/registration-email-resending', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeEach(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    authTestManager = new AuthTestManager(appTestManager.prisma, server);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен отправить письмо подтверждения, если emil корректный и пользователь не подтвержден', async () => {
    const registrationDtos: RegistrationUserInputDto[] =
      TestDtoFactory.generateRegistrationUserInputDto(1);
    await authTestManager.registration(registrationDtos);

    const [registrationDto] = registrationDtos;

    const dto: RegistrationEmailResendingInputDto = {
      email: registrationDto.email,
    };

    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    expect(sendEmailMock).toHaveBeenCalledTimes(2);

    const user: UserWithEmailConfirmation | null =
      await authTestManager.findUserWithEmailConfirmationByEmail(dto.email);
    expect(user!.emailConfirmationCode?.confirmationStatus).toBe(ConfirmationStatus.NotConfirmed);
  });
});
