import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PostViewDto } from '../view-dto/post.view-dto';

export function GetOwnPostSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Получить свой пост (черновик или опубликованный)' }),
    ApiParam({ name: 'id', type: Number, description: 'Идентификатор поста' }),
    ApiOkResponse({ description: 'Пост найден', type: PostViewDto }),
    ApiNotFoundResponse({ description: 'Пост не найден' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}

export function GetPublicPostSwagger() {
  return applyDecorators(
    ApiOperation({ summary: 'Получить публичный пост по id' }),
    ApiParam({ name: 'id', type: Number, description: 'Идентификатор поста' }),
    ApiOkResponse({ description: 'Пост найден', type: PostViewDto }),
    ApiNotFoundResponse({ description: 'Пост не найден' }),
  );
}
