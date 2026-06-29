import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../../common/exceptions/error-response-body.dto';
import { PostCommentsPageViewDto } from '../view-dto/post-comments-page.view-dto';

export function GetPostCommentsSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Получить корневые комментарии публикации (cursor-пагинация)',
      description:
        'Возвращает корневые комментарии поста, отсортированные от новых к старым. Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа.',
    }),
    ApiParam({ name: 'postId', type: Number, description: 'Идентификатор публикации' }),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 8 }),
    ApiOkResponse({
      description: 'Страница комментариев публикации',
      type: PostCommentsPageViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Ошибка валидации query-параметров (limit < 1) или некорректный cursor.',
      type: ErrorResponseDto,
    }),
    ApiNotFoundResponse({ description: 'Публикация не найдена' }),
  );
}
