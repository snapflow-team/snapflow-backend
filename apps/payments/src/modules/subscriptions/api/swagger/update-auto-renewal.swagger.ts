import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UpdateAutoRenewalInputDto } from '../input-dto/update-auto-renewal.input-dto';

export function UpdateAutoRenewalSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Поставить или убрать автопродление подписки',
    }),
    ApiBody({
      type: UpdateAutoRenewalInputDto,
    }),
    ApiNoContentResponse({
      description:
        'Автопродление успешно добавлено/убрано. Если значение параметра autoRenewal, переданное в запросе, совпадает с текущим значением, сохранённым в системе, ответом также будет статус 204 No Content',
    }),
    ApiUnauthorizedResponse({
      description: 'Пользователь не авторизован или передан недействительный access-токен',
    }),
    ApiBadRequestResponse({
      description: 'У пользователя отсутствует активные подписки',
    }),
  );
}
