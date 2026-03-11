import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PostsPageViewDto } from '../view-dto/posts-page.view-dto';

export function GetProfilePostsSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Получить публичные посты пользователя с пагинацией' }),
    ApiParam({ name: 'userId', type: Number, description: 'Идентификатор пользователя' }),
    ApiQuery({ name: 'pageNumber', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'pageSize', required: false, type: Number, example: 8 }),
    ApiOkResponse({ description: 'Список постов пользователя', type: PostsPageViewDto }),
    ApiNotFoundResponse({ description: 'Пользователь не найден' }),
  );
}
