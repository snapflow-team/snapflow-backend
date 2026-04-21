import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { PaginatedPaymentsSwaggerDto } from '../view-dto/paginated-payments-swagger.dto';

export function GetMyPaymentsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить историю своих платежей по подписке',
      description:
        'Возвращает только успешные платежи (status = PAID) текущего авторизованного пользователя.',
    }),
    ApiOkResponse({
      description: 'Пагинированный список платежей пользователя со статусом PAID',
      type: PaginatedPaymentsSwaggerDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован или передан недействительный access-токен',
    }),
  );
}
