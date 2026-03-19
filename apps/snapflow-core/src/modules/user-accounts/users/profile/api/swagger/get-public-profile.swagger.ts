import { applyDecorators } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { PublicProfileViewDto } from '../dto/view-dto/public-profile.view-dto';

export function ApiGetPublicProfile() {
  return applyDecorators(
    ApiOperation({
      summary: 'Получение публичного профиля пользователя',
    }),
    ApiOkResponse({
      description: 'Профиль пользователя успешно получен.',
      type: PublicProfileViewDto,
    }),
    ApiNotFoundResponse({
      description: 'Если профиль пользователя не найден.',
    }),
  );
}
