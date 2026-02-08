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
    }),
    ApiBody({
      description: 'Данные для восстановления пароля',
      type: PasswordRecoveryInputDto,
      examples: {
        default: {
          summary: 'Пример запроса',
          value: {
            email: 'ivan_01@example.com',
          },
        },
      },
    }),
    ApiNoContentResponse({
      description: 'Операция сброса пароля выполнено успешно',
    }),
    ApiBadRequestResponse({
      description:
        'Если в inputModel неверные значения (в частности, если пользователь с указанным email или username уже существует)',
      content: {
        'application/json': {
          examples: {
            validationError: {
              summary: 'Пример ошибки валидации',
              value: {
                code: 'VALIDATION_ERROR',
                message: 'Data validation error',
                errors: [{ field: 'username', message: 'Must be a string' }],
              },
            },
          },
        },
      },
    }),
  );
}
