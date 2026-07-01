import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UnreadNotificationsCountViewDto } from '../output/unread-notifications-count.view-dto';

export function GetUnreadNotificationsCountSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),

    ApiOperation({
      summary: 'Получить количество непрочитанных уведомлений',
      description:
        'Возвращает количество уведомлений пользователя, которые ещё не прочитаны (isRead = false).',
    }),

    ApiOkResponse({
      description: 'Количество непрочитанных уведомлений',
      type: UnreadNotificationsCountViewDto,
    }),

    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}
