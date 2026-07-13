import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChatMessagesPageViewDto } from '../view-dto/chat-messages-page.view-dto';

export function GetChatMessagesSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить историю сообщений чата (cursor-пагинация)',
      description:
        'Возвращает сообщения указанного чата, отсортированные от новых к старым. ' +
        'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа.',
    }),
    ApiParam({
      name: 'chatId',
      type: Number,
      description: 'Идентификатор чата',
      example: 10,
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 8,
      description: 'Количество сообщений на страницу',
    }),
    ApiOkResponse({
      description: 'Страница истории сообщений чата',
      type: ChatMessagesPageViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Некорректный chatId или параметры пагинации (cursor/limit)',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiForbiddenResponse({
      description: 'Пользователь не является участником чата',
    }),
  );
}
