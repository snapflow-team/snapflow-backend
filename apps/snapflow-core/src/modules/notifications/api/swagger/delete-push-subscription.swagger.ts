import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DeletePushSubscriptionInputDto } from '../input/delete-push-subscription.input-dto';

export function DeletePushSubscriptionSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),

    ApiOperation({
      summary: 'Удалить Web Push подписку',
      description: 'Удаляет push-подписку текущего пользователя по endpoint.',
    }),

    ApiBody({ type: DeletePushSubscriptionInputDto }),

    ApiNoContentResponse({
      description: 'Подписка успешно удалена',
    }),

    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}
