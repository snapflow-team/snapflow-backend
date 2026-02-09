import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginUserInputDto } from '../input-dto/login-user.input-dto';
import { LoginViewDto } from '../view-dto/login.view-dto';
import { ErrorResponseDto } from '../../../../../../../../libs/common/exceptions/dto/error-response-body.dto';

export function LoginSwagger() {
  return applyDecorators(
    ApiOperation({
      summary: 'Вход пользователя в систему',
    }),
    ApiBody({
      type: LoginUserInputDto,
    }),
    ApiOkResponse({
      description:
        'Возвращает JWT accessToken в теле ответа и JWT refreshToken в http-only secure cookie.',
      type: LoginViewDto,
    }),
    ApiBadRequestResponse({
      description: 'Если inputModel имеет неправильные значения',
      type: ErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Если password или email неверны',
    }),
  );
}
