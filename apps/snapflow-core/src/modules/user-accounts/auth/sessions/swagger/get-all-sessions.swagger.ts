import { ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function GetAllSessionsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Получаем все сессии текущего пользователя',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
    }),
  );
}
