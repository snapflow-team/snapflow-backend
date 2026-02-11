import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { PasswordRecoveryCodeInputDto } from '../input-dto/password-recovery-code.input-dto';

export function ApiCheckPasswordRecoveryCode() {
  return applyDecorators(
    ApiOperation({
      summary: 'Проверка кода восстановления пароля',
      description:
        'Проверяет корректность и актуальность кода восстановления пароля. ' +
        'Если код недействителен или просрочен, возвращается ошибка.',
    }),
    ApiBody({
      description: 'Данные для проверки кода восстановления пароля',
      type: PasswordRecoveryCodeInputDto,
    }),
    ApiNoContentResponse({
      description: 'Код восстановления корректен и действителен',
    }),
    ApiBadRequestResponse({
      description: 'Некорректный или просроченный код восстановления',
    }),
  );
}
