import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { PostViewDto } from '../view-dto/post.view-dto';

export function GetDraftPostsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Получить черновики пользователя' }),
    ApiOkResponse({
      description: 'Список черновиков',
      type: [PostViewDto],
    }),
  );
}
