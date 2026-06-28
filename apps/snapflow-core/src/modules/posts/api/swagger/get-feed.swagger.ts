import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/exceptions/error-response-body.dto';
import { FeedPageViewDto } from '../view-dto/feed-page.view-dto';

export function GetFeedSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить ленту постов подписок (cursor-пагинация)',
      description:
        'Возвращает опубликованные посты пользователей, на которых подписан текущий пользователь. ' +
        'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа. ' +
        'При отсутствии подписок возвращается пустая страница.',
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 8 }),
    ApiOkResponse({ description: 'Страница ленты постов', type: FeedPageViewDto }),
    ApiBadRequestResponse({
      description: 'Ошибка валидации query-параметров (limit < 1) или некорректный cursor.',
      type: ErrorResponseDto,
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
