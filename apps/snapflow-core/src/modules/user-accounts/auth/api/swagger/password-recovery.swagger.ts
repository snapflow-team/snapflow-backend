import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
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
    ApiForbiddenResponse({
      description:
        'Пользователь с указанным email не найден или восстановление пароля недоступно для данного аккаунта',
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
