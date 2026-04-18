import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ConfirmationEmailCodeInputDto } from '../input-dto/confirmation-email-code.input-dto';
import { ErrorResponseDto } from '../../../../../common/exceptions/error-response-body.dto';

export function ConfirmRegistrationSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Подтверждение регистрации',
    }),
    ApiBody({ type: ConfirmationEmailCodeInputDto }),
    ApiNoContentResponse({
      description: 'Электронная почта была подтверждена. Аккаунт был активирован',
    }),
    ApiBadRequestResponse({
      description: 'Если код подтверждения неверен, просрочен или уже применён',
      type: ErrorResponseDto,
    }),
    ApiTooManyRequestsResponse({
      description: 'Более 5 попыток с одного IP-адреса за 10 секунд',
    }),
  );
}
