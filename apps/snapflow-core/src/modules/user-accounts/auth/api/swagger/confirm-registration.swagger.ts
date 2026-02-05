import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ConfirmationEmailCodeInputDto } from '../input-dto/confirmation-email-code.input-dto';

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
      content: {
        'application/json': {
          examples: {
            validationError: {
              summary: 'Пример ошибки валидации',
              value: {
                code: 'VALIDATION_ERROR',
                message: 'Data validation error',
                errors: [
                  {
                    field: 'code',
                    message: 'Invalid confirmation code',
                  },
                ],
              },
            },
          },
        },
      },
      description: 'Код подтверждения неверен, просрочен или уже был использован.',
    }),
  );
}
