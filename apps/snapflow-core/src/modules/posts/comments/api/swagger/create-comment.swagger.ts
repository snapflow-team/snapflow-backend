import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateCommentInputDto } from '../input-dto/create-comment.input-dto';
import { CommentItemViewDto } from '../view-dto/comment-item.view-dto';

export function CreateCommentSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Создать комментарий к публикации' }),
    ApiParam({ name: 'postId', type: Number, description: 'Идентификатор публикации' }),
    ApiBody({ type: CreateCommentInputDto }),
    ApiCreatedResponse({
      description: 'Комментарий успешно создан',
      type: CommentItemViewDto,
    }),
    ApiBadRequestResponse({ description: 'Невалидные данные комментария' }),
    ApiNotFoundResponse({ description: 'Публикация или родительский комментарий не найдены' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
