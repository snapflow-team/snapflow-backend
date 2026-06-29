import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function FollowUserSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Подписаться на пользователя' }),
    ApiParam({ name: 'userId', type: Number, description: 'Идентификатор пользователя' }),
    ApiNoContentResponse({ description: 'Подписка успешно оформлена' }),
    ApiBadRequestResponse({ description: 'Нельзя подписаться на самого себя' }),
    ApiNotFoundResponse({ description: 'Пользователь не найден' }),
    ApiForbiddenResponse({ description: 'Нельзя подписаться на заблокированного пользователя' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
