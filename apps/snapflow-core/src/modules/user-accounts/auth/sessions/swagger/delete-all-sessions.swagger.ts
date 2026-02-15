import { ApiNoContentResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function DeleteAllSessionsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Удаляем все сессии пользователя кроме текущей',
    }),
    ApiNoContentResponse({
      description: 'Сессии удалены',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
    }),
  );
}
