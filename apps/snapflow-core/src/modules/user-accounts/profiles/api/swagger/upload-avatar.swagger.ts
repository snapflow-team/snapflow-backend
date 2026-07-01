import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AvatarViewDto } from '../dto/view-dto/acatar.view-dto';

export function ApiUploadAvatar() {
  return applyDecorators(
    ApiOperation({
      summary: 'Загрузка аватара пользователя',
    }),
    ApiBearerAuth('access-token'),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['avatar'],
        properties: {
          avatar: {
            type: 'string',
            format: 'binary',
            description: 'Файл аватара (JPEG или PNG, не более 10МБ)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Аватар успешно загружен',
      type: AvatarViewDto,
    }),
    ApiBadRequestResponse({
      description:
        'Если файл отсутствует, превышен максимальный размер или тип файла не поддерживается',
    }),
    ApiUnauthorizedResponse({
      description: 'Если пользователь не авторизован или access-токен недействителен',
    }),
  );
}
