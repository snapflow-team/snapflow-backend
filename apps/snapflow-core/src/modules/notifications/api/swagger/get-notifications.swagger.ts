import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationsPageViewDto } from '../output/notificaitonss-page-view.dto';
import { ErrorResponseDto } from '../../../../common/exceptions/error-response-body.dto';

export function GetNotificationsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),

    ApiOperation({
      summary: 'Получить список уведомлений пользователя (cursor-пагинация)',
      description:
        'Возвращает уведомления текущего пользователя, отсортированные от новых к старым. Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа.',
    }),

    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Cursor для пагинации (nextCursor из предыдущего ответа)',
    }),

    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 5,
      description: 'Количество уведомлений на страницу',
    }),

    ApiOkResponse({
      description: 'Список уведомлений',
      type: NotificationsPageViewDto,
    }),

    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),

    ApiBadRequestResponse({
      description: 'Некорректные параметры пагинации (cursor/limit)',
      type: ErrorResponseDto,
    }),
  );
}
