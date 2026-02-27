import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { formatValidationErrors } from '../../../../libs/common/exceptions/utils/format-validation-errors';
import { Extension } from '../../../../libs/common/exceptions/damain.exception';
import { ValidationException } from '../../../../libs/common/exceptions/validation-exception';

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
