import { ApiNoContentResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export function DeleteSessionByIdSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Удаляем сессию пользователя по deviceId',
    }),
    ApiNoContentResponse({
      description: 'Сессия удалена',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
    }),
  );
}
