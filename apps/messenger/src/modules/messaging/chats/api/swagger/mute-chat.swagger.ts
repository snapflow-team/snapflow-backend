import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MuteChatInputDto } from '../input-dto/mute-chat.input-dto';

export function MuteChatSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Заглушить уведомления чата',
      description:
        'Отключает push-уведомления по чату для текущего пользователя. ' +
        'Доставка сообщений в чат и подсчёт непрочитанного не меняются. ' +
        'Без mutedUntil или с null — mute бессрочный.',
    }),
    ApiParam({
      name: 'chatId',
      type: Number,
      description: 'Идентификатор чата',
      example: 10,
    }),
    ApiBody({ type: MuteChatInputDto, required: false }),
    ApiNoContentResponse({
      description: 'Mute успешно установлен',
    }),
    ApiBadRequestResponse({
      description: 'Некорректный chatId или mutedUntil',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiForbiddenResponse({
      description: 'Пользователь не является участником чата',
    }),
  );
}
