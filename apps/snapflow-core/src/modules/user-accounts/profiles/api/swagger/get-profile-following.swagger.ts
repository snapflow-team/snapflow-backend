import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../../common/exceptions/error-response-body.dto';
import { ProfileFollowListPageViewDto } from '../dto/view-dto/profile-follow-list-page.view-dto';

export function ApiGetProfileFollowing() {
  return applyDecorators(
    ApiParam({
      name: 'profileId',
      type: Number,
      description: 'Идентификатор профиля пользователя',
      example: 15,
    }),
    ApiOperation({
      summary: 'Список подписок профиля (cursor-пагинация)',
      description:
        'Возвращает пользователей, на которых подписан владелец профиля. Требуется JWT. ' +
        'Из выдачи исключаются удалённые и забаненные пользователи.',
    }),
    ApiBearerAuth('access-token'),
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 8 }),
    ApiOkResponse({
      description: 'Страница подписок профиля',
      type: ProfileFollowListPageViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Ошибка валидации query-параметров (limit < 1) или некорректный cursor.',
      type: ErrorResponseDto,
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
    ApiNotFoundResponse({ description: 'Профиль не найден' }),
  );
}
