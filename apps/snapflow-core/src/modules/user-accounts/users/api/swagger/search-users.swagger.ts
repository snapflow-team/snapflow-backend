import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../../common/exceptions/error-response-body.dto';
import { SearchUsersPageViewDto } from '../dto/view-dto/search-users-page.view-dto';

export function ApiSearchUsers() {
  return applyDecorators(
    ApiOperation({
      summary: 'Поиск пользователей по username (cursor-пагинация)',
      description: 'Возвращает пользователей с частичным совпадением username. Требуется JWT.',
    }),
    ApiBearerAuth('access-token'),
    ApiQuery({
      name: 'username',
      required: true,
      type: String,
      description: 'Частичное совпадение username',
      example: 'ali',
    }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 8 }),
    ApiOkResponse({
      description: 'Страница результатов поиска',
      type: SearchUsersPageViewDto,
    }),
    ApiBadRequestResponse({
      description:
        'Ошибка валидации query-параметров (пустой username, limit < 1) или некорректный cursor.',
      type: ErrorResponseDto,
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
