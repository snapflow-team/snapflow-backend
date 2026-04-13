import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreatePostInputDto } from '../input-dto/create-post.input-dto';
import { PostViewDto } from '../view-dto/post.view-dto';

export function CreatePublishPostSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Создать и опубликовать пост' }),
    ApiBody({ type: CreatePostInputDto }),
    ApiCreatedResponse({
      description: 'Пост успешно создан и опубликован',
      type: PostViewDto,
    }),
    ApiBadRequestResponse({ description: 'Невалидные данные или недоступные файлы' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}

export function CreateDraftPostSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Сохранить черновик поста' }),
    ApiBody({ type: CreatePostInputDto }),
    ApiCreatedResponse({
      description: 'Черновик успешно сохранен',
      type: PostViewDto,
    }),
    ApiBadRequestResponse({ description: 'Невалидные данные или недоступные файлы' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
