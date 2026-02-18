import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

export function GoogleAuthSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Инициирует аутентификацию через Google OAuth',
      description:
        'Перенаправляет пользователя на страницу аутентификации Google для получения разрешения на доступ.',
    }),
    ApiResponse({
      status: 302,
      description: 'Успешный редирект на Google (handled by Passport)',
    }),
    ApiUnauthorizedResponse({
      description:
        'Если аутентификация не удалась (например, неверные credentials или конфигурация)',
    }),
  );
}
