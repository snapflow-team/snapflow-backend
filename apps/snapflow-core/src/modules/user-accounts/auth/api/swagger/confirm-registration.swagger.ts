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
      description: 'Если код подтверждения неверен, просрочен или уже применён',
    }),
    ApiBadRequestResponse({
      type: ErrorResponseDto,
    }),
  );
}
