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
import { DeleteMessageScope } from '../input-dto/delete-message.query-dto';

export function DeleteMessageSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Удалить сообщение',
      description:
        `scope=${DeleteMessageScope.Me} — скрыть сообщение только для текущего пользователя (без лимита по времени). ` +
        `scope=${DeleteMessageScope.Everyone} — удалить для всех участников (только автор, в пределах окна удаления).`,
    }),
    ApiParam({
      name: 'messageId',
      type: Number,
      description: 'Идентификатор сообщения',
      example: 100,
    }),
    ApiQuery({
      name: 'scope',
      enum: DeleteMessageScope,
      description: 'Область удаления: только для себя или для всех участников',
      example: DeleteMessageScope.Me,
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
        `Пользователь не участник чата, не автор (для scope=${DeleteMessageScope.Everyone}) или окно удаления истекло`,
    }),
    ApiNotFoundResponse({
      description: 'Сообщение не найдено',
    }),
  );
}
