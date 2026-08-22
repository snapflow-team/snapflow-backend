import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SendMessageInputDto } from '../input-dto/send-message.input-dto';
import { MessageViewDto } from '../../../sharing/api/view-dto/message.view-dto';

export function SendMessageSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({ summary: 'Отправить текстовое сообщение пользователю' }),
    ApiBody({ type: SendMessageInputDto }),
    ApiCreatedResponse({
      description: 'Сообщение успешно отправлено',
      type: MessageViewDto,
    }),
    ApiBadRequestResponse({
      description:
        'Невалидные данные сообщения, невалидный replyToMessageId или попытка отправить сообщение самому себе',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
