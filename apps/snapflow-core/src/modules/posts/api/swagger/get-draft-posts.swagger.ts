import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { PostViewDto } from '../view-dto/post.view-dto';

export function GetDraftPostsSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Получить черновики пользователя' }),
    ApiOkResponse({
      description: 'Список черновиков',
      type: [PostViewDto],
    }),
  );
}
