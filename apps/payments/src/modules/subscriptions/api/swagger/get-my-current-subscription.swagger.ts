import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SubscriptionViewDto } from '../view-dto/subscription.view-dto';

export function GetMyCurrentSubscriptionSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить текущую активную подписку',
      description:
        'Возвращает только активную подписку (status = ACTIVE | PAST_DUE) текущего авторизованного пользователя.',
    }),
    ApiOkResponse({
      description: 'Текущая подписка пользователя',
      type: SubscriptionViewDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован или передан недействительный access-токен',
    }),
  );
}
