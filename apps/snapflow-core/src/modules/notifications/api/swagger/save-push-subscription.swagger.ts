import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SavePushSubscriptionInputDto } from '../input/save-push-subscription.input-dto';

export function SavePushSubscriptionSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),

    ApiOperation({
      summary: 'Сохранить Web Push подписку',
      description:
        'Регистрирует или обновляет push-подписку текущего пользователя. Идемпотентно по endpoint.',
    }),

    ApiBody({ type: SavePushSubscriptionInputDto }),

    ApiCreatedResponse({
      description: 'Подписка успешно сохранена',
    }),

    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}
