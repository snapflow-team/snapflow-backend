import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UpdatePostInputDto } from '../input-dto/update-post.input.dto';

export function EditPostSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Редактировать описание поста' }),
    ApiParam({ name: 'id', type: Number, description: 'Идентификатор поста' }),
    ApiBody({ type: UpdatePostInputDto }),
    ApiNoContentResponse({ description: 'Пост успешно обновлён' }),
    ApiNotFoundResponse({ description: 'Пост не найден' }),
    ApiBadRequestResponse({ description: 'Некорректные данные' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
