import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { NewPasswordInputDto } from '../input-dto/new-password.input-dto';

export function ApiNewPassword() {
  return applyDecorators(
    ApiOperation({
      summary: 'Сброс пароля пользователя',
      description:
        'Позволяет установить новый пароль для пользователя по коду восстановления. ' +
        'Если код восстановления неверный или просрочен, возвращается ошибка.',
    }),

    ApiBody({
      description: 'Данные для установки нового пароля',
      type: NewPasswordInputDto,
    }),

    ApiNoContentResponse({
      description: 'Если код актуален и принимается новый пароль',
    }),

    ApiBadRequestResponse({
      description:
        'Если inputModel имеет неправильное значение (за неправильную длину пароля) или RecoveryCode неверен или истёк',
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
