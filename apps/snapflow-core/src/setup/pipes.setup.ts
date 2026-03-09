import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { formatValidationErrors } from '../../../../libs/exceptions/core/utils/format-validation-errors';
import { Extension } from '../../../../libs/exceptions/http/damain.exception';
import { ValidationException } from '../../../../libs/exceptions/core/validation-exception';

export function pipesSetup(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const extensions: Extension[] = formatValidationErrors(errors);
        return new ValidationException(extensions);
      },
    }),
  );
}
