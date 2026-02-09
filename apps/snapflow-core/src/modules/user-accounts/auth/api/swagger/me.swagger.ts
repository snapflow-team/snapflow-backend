import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MeViewDto } from '../view-dto/me.view-dto';

export function ApiMe() {
  return applyDecorators(
    ApiOperation({
      summary: 'Получить данные текущего пользователя',
      description: 'Возвращает информацию о текущем авторизованном пользователе',
    }),
    ApiBearerAuth('access-token'),
    ApiOkResponse({
      description: 'Данные текущего пользователя',
      type: MeViewDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Если пользователь не авторизован или access-токен недействителен',
    }),
  );
}
