import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PostViewDto } from '../view-dto/post.view-dto';

export function PublishPostSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Опубликовать черновик поста' }),
    ApiCreatedResponse({ description: 'Черновик успешно опубликован', type: PostViewDto }),
    ApiBadRequestResponse({ description: 'Пост нельзя опубликовать' }),
    ApiNotFoundResponse({ description: 'Пост не найден' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
