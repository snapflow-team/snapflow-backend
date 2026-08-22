import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PRESENCE_USER_IDS_MAX_BATCH } from '../input-dto/get-presence.query-params.dto';
import { PresenceViewDto } from '../view-dto/presence.view-dto';

export function GetPresenceSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Получить presence-статусы пользователей (батч)',
      description:
        'Возвращает online/lastSeenAt для списка userIds с учётом взаимной приватности: ' +
        'если запрашивающий или цель скрыли активность — online=false и lastSeenAt=null.',
    }),
    ApiQuery({
      name: 'userIds',
      required: true,
      type: String,
      example: '1,2,3',
      description:
        'Идентификаторы пользователей через запятую (или массив). ' +
        `Максимум ${PRESENCE_USER_IDS_MAX_BATCH} id за запрос.`,
    }),
    ApiOkResponse({
      description: 'Список presence-статусов',
      type: PresenceViewDto,
      isArray: true,
    }),
    ApiBadRequestResponse({
      description: 'Некорректный или пустой список userIds / превышен лимит батча',
    }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
