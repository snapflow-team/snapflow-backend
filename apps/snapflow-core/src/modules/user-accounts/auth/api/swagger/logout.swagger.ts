import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function LogoutSwagger() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Выход из системы',
      description:
        'Завершает текущую сессию пользователя. Refresh token удаляется из httpOnly cookie.',
    }),

    ApiSecurity('refresh-token'),

    ApiNoContentResponse({
      description: 'Пользователь успешно вышел из системы',
    }),

    ApiUnauthorizedResponse({
      description: 'Отсутствует, истёк или некорректен JWT refresh-токен',
    }),
  );
}
