import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function UnfollowUserSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Отписаться от пользователя' }),
    ApiParam({ name: 'userId', type: Number, description: 'Идентификатор пользователя' }),
    ApiNoContentResponse({ description: 'Подписка успешно отменена' }),
    ApiBadRequestResponse({ description: 'Нельзя отписаться от самого себя' }),
    ApiNotFoundResponse({ description: 'Пользователь не найден' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
