import { ApiOperation, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function GetAllSessionsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Получаем все сессии текущего пользователя',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
