import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EditMessageInputDto } from '../input-dto/edit-message.input-dto';
import { MessageViewDto } from '../../sharing/api/view-dto/message.view-dto';

export function EditMessageSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Редактировать текст сообщения',
      description:
        'Только автор может редактировать сообщение в пределах окна редактирования. ' +
        'Удалённые для всех сообщения редактировать нельзя.',
    }),
    ApiParam({
      name: 'messageId',
      type: Number,
      description: 'Идентификатор сообщения',
      example: 100,
    }),
    ApiBody({ type: EditMessageInputDto }),
    ApiOkResponse({
      description: 'Сообщение успешно отредактировано',
      type: MessageViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Невалидный текст сообщения или messageId',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiForbiddenResponse({
      description:
        'Пользователь не участник чата, не автор сообщения, окно редактирования истекло ' +
        'или сообщение удалено для всех',
    }),
    ApiNotFoundResponse({
      description: 'Сообщение не найдено',
    }),
  );
}
