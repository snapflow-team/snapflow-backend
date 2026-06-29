import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function MarkAllNotificationsReadSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),

    ApiOperation({
      summary: 'Отметить все уведомления как прочитанные',
      description: 'Обновляет все уведомления текущего пользователя: isRead = true.',
    }),

    ApiNoContentResponse({
      description: 'Уведомления успешно отмечены как прочитанные',
    }),

    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}
