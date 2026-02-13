import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BASE_URL } from '../../constants/auth-tokens.inject-constants';
import { applyDecorators } from '@nestjs/common';

export function GoogleCallbackSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Callback от Google',
      description: 'Обрабатывает ответ от Google после аутентификации',
    }),
    ApiResponse({
      status: 302,
      description:
        'Успешная аутентификация. Перенаправление на фронтенд с установкой refreshToken в cookie',
      headers: {
        'Set-Cookie': {
          description: 'Устанавливает refreshToken в httpOnly cookie',
          schema: { type: 'string' },
        },
        Location: {
          description: 'URL для перенаправления',
          schema: { type: 'string', example: `${BASE_URL}` },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Ошибка аутентификации',
    }),
  );
}
