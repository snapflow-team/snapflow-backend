import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { RegistrationEmailResendingInputDto } from '../input-dto/registration-email-resending.input-dto';

export function ApiRegisterEmailResendingCommand() {
  return applyDecorators(
    ApiOperation({
      summary: 'Повторно отправить подтверждение регистрации, если пользователь существует',
    }),
    ApiBody({
      description: 'Данные для повторного подтверждения регистрации',
      type: RegistrationEmailResendingInputDto,
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
      description:
        'Входные данные приняты. Электронное письмо с кодом подтверждения будет отправлено на указанный адрес электронной почты. Код подтверждения должен находиться внутри ссылки в качестве параметра запроса, например',
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
