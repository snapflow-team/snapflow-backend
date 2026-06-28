import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function TogglePostLikeSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Поставить или убрать лайк с публикации' }),
    ApiParam({ name: 'postId', type: Number, description: 'Идентификатор публикации' }),
    ApiNoContentResponse({ description: 'Лайк успешно переключён' }),
    ApiNotFoundResponse({ description: 'Публикация не найдена' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
