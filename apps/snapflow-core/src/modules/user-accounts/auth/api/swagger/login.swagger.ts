import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginUserInputDto } from '../input-dto/login-user.input-dto';

export function LoginSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Вход пользователя в систему',
    }),
    ApiBody({
      type: LoginUserInputDto,
    }),
    ApiOkResponse({
      description:
        'Возвращает JWT accessToken в теле ответа и JWT refreshToken в http-only secure cookie.',
      content: { 'application/json': { example: { accessToken: 'string' } } },
    }),
    ApiBadRequestResponse({
      content: {
        'application/json': {
          examples: {
            validationError: {
              summary: 'Пример ошибки валидации',
              value: {
                code: 'VALIDATION_ERROR',
                message: 'Data validation error',
                errors: [
                  {
                    field: 'email',
                    message: 'email must be an email',
                  },
                ],
              },
            },
          },
        },
      },
    }),

    ApiUnauthorizedResponse({
      content: {
        'application/json': {
          examples: {
            validationError: {
              summary: 'Пример ошибки валидации',
              value: {
                code: 'UNAUTHORIZED',
                message: 'Data validation error',
                errors: [],
              },
            },
          },
        },
      },
    }),
  );
}
