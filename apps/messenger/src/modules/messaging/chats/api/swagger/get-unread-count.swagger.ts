import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UnreadCountViewDto } from '../view-dto/unread-count.view-dto';

export function GetUnreadCountSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить суммарный бейдж непрочитанных сообщений',
      description:
        'Возвращает общее число непрочитанных сообщений пользователя по всем чатам. ' +
        'Значение согласовано с суммой unreadCount из GET /messenger/chats.',
    }),
    ApiOkResponse({
      description: 'Агрегированный счётчик непрочитанного',
      type: UnreadCountViewDto,
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
