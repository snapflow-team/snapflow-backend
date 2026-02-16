import {
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
    ApiForbiddenResponse({
      description: 'Доступ запрещен. Вы можете управлять только своими активными устройствами',
    }),
    ApiNotFoundResponse({
      description: 'Сессия не найдена',
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
