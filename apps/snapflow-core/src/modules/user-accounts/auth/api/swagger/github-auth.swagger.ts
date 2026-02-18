import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

export function GithubAuthSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Инициирует аутентификацию через GitHub OAuth',
      description:
        'Перенаправляет пользователя на страницу аутентификации GitHub для получения разрешения на доступ.',
    }),
    ApiResponse({
      status: 302,
      description: 'Успешный редирект на GitHub (handled by Passport)',
    }),
    ApiUnauthorizedResponse({
      description:
        'Если аутентификация не удалась (например, неверные credentials или конфигурация)',
    }),
  );
}
