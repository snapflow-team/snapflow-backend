import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function UnmuteChatSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Снять mute с чата',
      description:
        'Удаляет mute-настройку текущего пользователя для чата. ' +
        'Повторный вызов при отсутствии настройки — no-op.',
    }),
    ApiParam({
      name: 'chatId',
      type: Number,
      description: 'Идентификатор чата',
      example: 10,
    }),
    ApiNoContentResponse({
      description: 'Mute успешно снят (или уже отсутствовал)',
    }),
    ApiBadRequestResponse({
      description: 'Некорректный chatId',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiForbiddenResponse({
      description: 'Пользователь не является участником чата',
    }),
  );
}
