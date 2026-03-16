import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiUnauthorizedResponse, } from '@nestjs/swagger';

export function ApiDeleteAvatar() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Удаление аватара пользователя',
      description:
        'Удаляет текущий аватар пользователя. Если аватар отсутствует, операция выполняется без ошибки.',
    }),

    ApiNoContentResponse({
      description: 'Аватар успешно удалён.',
    }),

    ApiUnauthorizedResponse({
      description: 'Если пользователь не авторизован или access-токен недействителен.',
    }),
  );
}
