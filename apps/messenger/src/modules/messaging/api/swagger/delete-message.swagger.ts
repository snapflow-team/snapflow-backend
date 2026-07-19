import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function DeleteMessageSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Удалить сообщение',
      description:
        'scope=me — скрыть сообщение только для текущего пользователя (без лимита по времени). ' +
        'scope=everyone — удалить для всех участников (только автор, в пределах окна удаления).',
    }),
    ApiParam({
      name: 'messageId',
      type: Number,
      description: 'Идентификатор сообщения',
      example: 100,
    }),
    ApiQuery({
      name: 'scope',
      enum: ['me', 'everyone'],
      description: 'Область удаления: только для себя или для всех участников',
      example: 'me',
    }),
    ApiNoContentResponse({
      description: 'Сообщение успешно удалено (или already deleted for everyone)',
    }),
    ApiBadRequestResponse({
      description: 'Невалидный messageId или scope',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiForbiddenResponse({
      description:
        'Пользователь не участник чата, не автор (для scope=everyone) или окно удаления истекло',
    }),
    ApiNotFoundResponse({
      description: 'Сообщение не найдено',
    }),
  );
}
