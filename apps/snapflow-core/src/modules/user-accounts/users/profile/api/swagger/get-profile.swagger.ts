import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProfileViewDto } from '../dto/view-dto/profile.view-dto';

export function ApiGetProfile() {
  return applyDecorators(
    ApiOperation({
      summary: 'Получение профиля пользователя',
    }),
    ApiBearerAuth('access-token'),
    ApiOkResponse({
      description: 'Профиль пользователя успешно получен.',
      type: ProfileViewDto,
    }),
    ApiNotFoundResponse({
      description: 'Если профиль пользователя не найден.',
    }),
    ApiUnauthorizedResponse({
      description: 'Если пользователь не авторизован или access-токен недействителен',
    }),
  );
}
