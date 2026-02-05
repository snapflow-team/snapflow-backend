import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { formatValidationErrors } from '../../../../libs/common/exceptions/utils/error-formatter.util';
import { ErrorCodes } from '../../../../libs/common/exceptions/error-codes.enum';

export function pipesSetup(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        return new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Data validation error',
          errors: formatValidationErrors(errors),
        });
      },
    }),
  );
}
