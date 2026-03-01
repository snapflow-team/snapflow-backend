import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreatePostInputDto } from '../input-dto/create-post.input-dto';
import { PostViewDto } from '../view-dto/post.view-dto';

export function CreatePublishPostSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Создать и опубликовать пост',
    }),
    ApiBody({
      type: CreatePostInputDto,
    }),
    ApiCreatedResponse({
      description: 'Пост успешно создан и опубликован',
      type: PostViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Невалидные данные или недоступные файлы',
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}

export function CreateDraftPostSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Создать черновик поста',
    }),
    ApiBody({
      type: CreatePostInputDto,
    }),
    ApiCreatedResponse({
      description: 'Черновик поста успешно создан',
      type: PostViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Невалидные данные или недоступные файлы',
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}

export function PublishPostSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Опубликовать черновик поста',
    }),
    ApiCreatedResponse({
      description: 'Черновик успешно опубликован',
      type: PostViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Пост нельзя опубликовать (не черновик/без медиа)',
    }),
    ApiNotFoundResponse({
      description: 'Пост не найден',
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}
