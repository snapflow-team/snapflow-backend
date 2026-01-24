import {
  BadRequestException,
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { formatValidationErrors } from '../../../../libs/common/exceptions/utils/error-formatter.util';

export function pipesSetup(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors: ValidationError[]) => {
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Data validation error',
          errors: formatValidationErrors(errors),
        });
      },
    }),
  );
}
