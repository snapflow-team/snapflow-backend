import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PublicProfileViewDto } from '../dto/view-dto/public-profile.view-dto';

export function ApiGetPublicProfile() {
  return applyDecorators(
    ApiParam({
      name: 'profileId',
      type: String,
      description: 'Идентификатор профиля пользователя',
    }),
    ApiOperation({
      summary: 'Получение публичного профиля пользователя',
      description:
        'Публичный эндпоинт. Bearer token опционален: при валидном JWT в ответе будет поле isFollowing. ' +
        'userMetadata содержит followersCount (подписчики), followingCount (подписки) и publicationsCount.',
    }),
    ApiBearerAuth('access-token'),
    ApiOkResponse({
      description: 'Профиль пользователя успешно получен.',
      type: PublicProfileViewDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Невалидный или истёкший JWT при переданном заголовке Authorization.',
    }),
    ApiNotFoundResponse({
      description: 'Если профиль пользователя не найден.',
    }),
  );
}
