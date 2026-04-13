import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PostViewDto } from '../view-dto/post.view-dto';

export function GetPostByIdSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Получить пост по id' }),
    ApiParam({ name: 'id', type: String, description: 'Идентификатор поста' }),
    ApiOkResponse({ description: 'Пост найден', type: PostViewDto }),
    ApiNotFoundResponse({ description: 'Пост не найден' }),
  );
}
