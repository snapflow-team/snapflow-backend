import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfirmUploadViewDto } from '../../../../../../../../libs/contracts/files';
import { ConfirmUploadInputDto } from '../input-dto/confirm-upload-urls.input-dto';

export function ConfirmUploadsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Подтвердить загрузку медиафайлов',
      description: 'Подтверждает, что файлы уже загружены в storage по выданным signed URL.',
    }),
    ApiBody({ type: ConfirmUploadInputDto }),
    ApiCreatedResponse({
      description: 'Загрузка файлов успешно подтверждена',
      type: ConfirmUploadViewDto,
    }),
    ApiBadRequestResponse({ description: 'Файл не загружен в хранилище или данные некорректны' }),
    ApiNotFoundResponse({ description: 'Один или несколько файлов не найдены' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
