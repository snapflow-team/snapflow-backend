import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { PasswordRecoveryInputDto } from '../input-dto/password-recovery.input-dto';

export function ApiPasswordRecovery() {
  return applyDecorators(
    ApiOperation({
      summary: 'Восстановление пароля',
      description:
        'Восстановление пароля через подтверждение по электронной почте. Письмо должно отправляться с RecoveryCode внутри',
    }),
    ApiBody({
      description: 'Данные для восстановления пароля',
      type: PasswordRecoveryInputDto,
    }),
    ApiNoContentResponse({
      description: 'Операция сброса пароля выполнено успешно',
    }),
    ApiBadRequestResponse({
      description: 'Если в inputModel неверные значения',
    }),
  );
}
