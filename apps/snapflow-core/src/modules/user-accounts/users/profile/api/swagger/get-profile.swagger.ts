import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ProfileViewDto } from '../dto/view-dto/profile.view-dto';

export function ApiGetProfile() {
  return applyDecorators(
    ApiOperation({
      summary: 'Получение профиля пользователя по ID',
    }),
    ApiParam({
      name: 'userId',
      type: String,
      required: true,
      description: 'ID пользователя',
      example: 1,
    }),
    ApiOkResponse({
      description: 'Профиль пользователя успешно получен.',
      type: ProfileViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Если параметр userId не валидный.',
    }),
    ApiNotFoundResponse({
      description:
        'Если пользователь с таким ID не найден или не найден профиль этого пользователя.',
    }),
  );
}
