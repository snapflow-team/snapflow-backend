import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { PostViewDto } from '../view-dto/post.view-dto';

export function GetDraftPostsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Получить черновик поста' }),
    ApiOkResponse({
      description: 'Черновик поста',
      type: PostViewDto,
    }),
    ApiNotFoundResponse({ description: 'Черновик не найден' }),
  );
}
