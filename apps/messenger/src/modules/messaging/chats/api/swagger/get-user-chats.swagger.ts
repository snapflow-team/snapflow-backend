import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserChatsPageViewDto } from '../view-dto/user-chats-page.view-dto';

export function GetUserChatsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить список чатов пользователя (cursor-пагинация)',
      description:
        'Возвращает 1:1 чаты текущего пользователя, отсортированные по времени последнего сообщения. ' +
        'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа.',
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
      description: 'Количество чатов на страницу',
    }),
    ApiOkResponse({
      description: 'Страница списка чатов',
      type: UserChatsPageViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Некорректные параметры пагинации (cursor/limit)',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
