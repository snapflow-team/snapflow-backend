import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { TotalCountRegisteredUsersViewDto } from '../dto/view-dto/total-count-registered-users.view-dto';

export function ApiGetTotalUsersCount() {
  return applyDecorators(
    ApiOperation({
      summary: 'Получение общего количества зарегистрированных пользователей',
      description: 'Возвращает количество всех пользователей',
    }),

    ApiOkResponse({
      description: 'Количество пользователей успешно получено.',
      type: TotalCountRegisteredUsersViewDto,
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
