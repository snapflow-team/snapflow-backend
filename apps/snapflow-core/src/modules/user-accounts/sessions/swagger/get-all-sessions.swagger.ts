import {
  ApiOkResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';
import { SessionsViewDto } from '../api/dto/view-dto/sessions.view-dto';

export function GetAllSessionsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Получаем все сессии текущего пользователя',
    }),
    ApiOkResponse({
      description: 'Список всех сессий пользователя',
      type: SessionsViewDto,
      isArray: true,
      example: [
        {
          deviceId: 'f11cf4ee-2e4e-433b-8539-0634d79e8db',
          ip: '127.0.0.1',
          lastActive: '2026-02-15T18:59:28.562Z',
          browserName: 'Chrome',
          browserVersion: '124.0.0.0',
          deviceName: 'MacBook Pro',
          osName: 'macOS',
          osVersion: '14.4',
          deviceType: 'desktop',
          isCurrent: true,
        },
      ],
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
