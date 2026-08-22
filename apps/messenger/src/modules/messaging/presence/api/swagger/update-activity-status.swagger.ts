import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UpdateActivityStatusInputDto } from '../input-dto/update-activity-status.input-dto';

export function UpdateActivityStatusSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Обновить настройку показа статуса активности',
      description:
        'Включает или выключает показ online/lastSeenAt. При выключении собеседникам ' +
        'рассылается скрытие статуса; при включении — актуальный presence.',
    }),
    ApiBody({ type: UpdateActivityStatusInputDto }),
    ApiNoContentResponse({
      description: 'Настройка успешно обновлена',
    }),
    ApiBadRequestResponse({
      description: 'Некорректное тело запроса (showActivityStatus должен быть boolean)',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
