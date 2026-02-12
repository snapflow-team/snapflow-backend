import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { LoginViewDto } from '../view-dto/login.view-dto';

export function RefreshTokenSwagger() {
  return applyDecorators(
    ApiSecurity('refresh-token'),

    ApiOperation({
      summary: 'Создание новой пары токенов',
    }),

    ApiOkResponse({
      description:
        'Возвращает JWT accessToken в теле ответа и JWT refreshToken в http-only secure cookie.',
      type: LoginViewDto,
    }),

    ApiUnauthorizedResponse({
      description: 'Unauthorized',
    }),
  );
}
