import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GenerateUploadUrlViewDto } from '../../../../../../../../libs/contracts/files';
import { GenerateUploadUrlsInputDto } from '../input-dto/generate-upload-urls.input-dto';

export function GenerateUploadUrlsSwagger() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiOperation({
      summary: 'Сгенерировать ссылки для загрузки медиафайлов',
      description:
        'Flow: 1) Вызвать POST /media/upload-url. 2) Для каждого полученного uploadUrl выполнить отдельный PUT-запрос с телом файла напрямую в storage. 3) После успешной загрузки всех файлов вызвать POST /media/confirm-uploads.',
    }),
    ApiBody({ type: GenerateUploadUrlsInputDto }),
    ApiOkResponse({
      description: 'Ссылки для загрузки успешно сгенерированы',
      type: GenerateUploadUrlViewDto,
      isArray: true,
    }),
    ApiBadRequestResponse({ description: 'Некорректные данные запроса' }),
    ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' }),
  );
}
