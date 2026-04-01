import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function DeletePostSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Удалить пост' }),
    ApiParam({ name: 'id', type: String, description: 'Идентификатор поста' }),
    ApiNoContentResponse({ description: 'Пост успешно удалён' }),
    ApiNotFoundResponse({ description: 'Пост не найден' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
