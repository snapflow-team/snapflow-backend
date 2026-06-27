import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function ToggleCommentLikeSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Поставить или убрать лайк с комментария' }),
    ApiParam({ name: 'postId', type: Number, description: 'Идентификатор публикации' }),
    ApiParam({ name: 'commentId', type: Number, description: 'Идентификатор комментария' }),
    ApiNoContentResponse({ description: 'Лайк успешно переключён' }),
    ApiNotFoundResponse({ description: 'Публикация или комментарий не найдены' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
