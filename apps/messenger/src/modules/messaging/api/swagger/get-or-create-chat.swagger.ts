import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetOrCreateChatInputDto } from '../input-dto/get-or-create-chat.input-dto';
import { ChatViewDto } from '../view-dto/chat.view-dto';

export function GetOrCreateChatSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить или создать 1:1 чат с пользователем',
      description:
        'Идемпотентно возвращает существующий чат между текущим пользователем и указанным собеседником ' +
        'или создаёт новый без отправки сообщения.',
    }),
    ApiBody({ type: GetOrCreateChatInputDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Чат найден или создан',
      type: ChatViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Невалидный interlocutorId или попытка создать чат с самим собой',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
