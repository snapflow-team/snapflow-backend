import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MarkChatReadInputDto } from '../input-dto/mark-chat-read.input-dto';

export function MarkChatReadSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Отметить сообщения чата как прочитанные',
      description:
        'Обновляет lastReadMessageId текущего пользователя. ' +
        'Повторный вызов с меньшим или тем же id — no-op (без даунгрейда).',
    }),
    ApiParam({
      name: 'chatId',
      type: Number,
      description: 'Идентификатор чата',
      example: 10,
    }),
    ApiBody({ type: MarkChatReadInputDto }),
    ApiNoContentResponse({
      description: 'Состояние прочтения успешно обновлено (или no-op)',
    }),
    ApiBadRequestResponse({
      description: 'Некорректный chatId или lastReadMessageId',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiForbiddenResponse({
      description: 'Пользователь не является участником чата',
    }),
    ApiNotFoundResponse({
      description: 'Сообщение не найдено или не принадлежит указанному чату',
    }),
  );
}
