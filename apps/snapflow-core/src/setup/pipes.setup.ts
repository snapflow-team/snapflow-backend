import { INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import {
  formatValidationErrors,
  IExtension,
  ValidationException,
} from '../../../../libs/exceptions/core';

export function pipesSetup(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        // todo: создать базовую formatValidationErrors
        const extensions: IExtension[] = formatValidationErrors(errors);
        return new ValidationException(extensions);
      },
    }),
  );
}
