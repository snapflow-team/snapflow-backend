import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { UpdateProfileInputDto } from '../dto/input-dto/update-profile.input-dto';
import { ErrorResponseDto } from '../../../../../../common/exceptions/error-response-body.dto';

export function ApiUpdateProfile() {
  return applyDecorators(
    ApiOperation({
      summary: 'Обновление профиля текущего пользователя',
    }),
    ApiBearerAuth('access-token'),
    ApiBody({
      type: UpdateProfileInputDto,
    }),
    ApiNoContentResponse({
      description: 'Профиль успешно обновлён.',
    }),
    ApiBadRequestResponse({
      description: 'Если поля в теле запроса не проходят валидацию.',
      type: ErrorResponseDto,
    }),
  );
}
