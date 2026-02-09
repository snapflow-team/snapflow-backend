import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ConfirmationEmailCodeInputDto } from '../input-dto/confirmation-email-code.input-dto';
import { ErrorResponseDto } from '../../../../../../../../libs/common/exceptions/dto/error-response-body.dto';

export function ConfirmRegistrationSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Подтверждение регистрации',
    }),
    ApiBody({ type: ConfirmationEmailCodeInputDto }),
    ApiNoContentResponse({
      description: 'Email подтверждён. Аккаунт успешно активирован!',
    }),
    ApiBadRequestResponse({
      type: ErrorResponseDto,
    }),
  );
}
1;
