import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PostsPageViewDto } from '../view-dto/posts-page.view-dto';

export function GetPublicPostsSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Получить публичные посты с пагинацией' }),
    ApiQuery({ name: 'pageNumber', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'pageSize', required: false, type: Number, example: 4 }),
    ApiOkResponse({ description: 'Список постов пользователя', type: PostsPageViewDto }),
    ApiNotFoundResponse({ description: 'Пользователь не найден' }),
  );
}
