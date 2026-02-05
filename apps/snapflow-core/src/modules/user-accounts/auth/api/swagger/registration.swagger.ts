import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { RegistrationUserInputDto } from '../input-dto/registration-user.input-dto';

export function ApiRegistration() {
  return applyDecorators(
    ApiOperation({
      summary: 'Регистрация пользователя',
      description:
        'Создаёт нового пользователя. Генерируется код подтверждения и отправляется на email.',
    }),
    ApiBody({
      description: 'Данные для регистрации пользователя',
      type: RegistrationUserInputDto,
      examples: {
        default: {
          summary: 'Пример запроса',
          value: {
            username: 'ivan_01',
            email: 'ivan_01@example.com',
            password: 'Qwerty1!',
          },
        },
      },
    }),
    ApiNoContentResponse({
      description:
        'Пользователь успешно зарегистрирован. Письмо с кодом подтверждения будет отправлено на переданный адрес электронной почты',
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
                errors: [
                  { field: 'username', message: 'Must be a string' },
                  {
                    field: 'email',
                    message:
                      'Email must be a valid address in the format local-part@domain.tld (letters, digits, underscore, dot and hyphen allowed in local part and domain).',
                  },
                  { field: 'password', message: 'Must be a string' },
                ],
              },
            },
          },
        },
      },
    }),
  );
}
