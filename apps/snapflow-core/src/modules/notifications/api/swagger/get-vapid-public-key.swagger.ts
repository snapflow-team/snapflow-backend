import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { VapidPublicKeyViewDto } from '../output/vapid-public-key.view-dto';

export function GetVapidPublicKeySwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),

    ApiOperation({
      summary: 'Получить публичный VAPID-ключ',
      description:
        'Возвращает публичный VAPID-ключ приложения для вызова pushManager.subscribe на клиенте.',
    }),

    ApiOkResponse({
      description: 'Публичный VAPID-ключ',
      type: VapidPublicKeyViewDto,
    }),

    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован',
    }),
  );
}
