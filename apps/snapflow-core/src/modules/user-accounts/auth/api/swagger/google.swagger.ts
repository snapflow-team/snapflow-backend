import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function GoogleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Аутентификация через Google',
      description: 'Перенаправляет пользователя на страницу авторизации Google',
    }),
    ApiResponse({
      status: 302,
      description: 'Перенаправление на Google OAuth 2.0',
    }),
  );
}
