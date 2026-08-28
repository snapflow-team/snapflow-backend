import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import {
  formatValidationErrors,
  IExtension,
  ValidationException,
} from '../../../../libs/exceptions/core';

export function httpPipesSetup(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const extensions: IExtension[] = formatValidationErrors(errors);
        return new ValidationException(extensions);
      },
    }),
  );
}
