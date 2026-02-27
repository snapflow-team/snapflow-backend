import { INestApplication } from '@nestjs/common';
import { ValidationExceptionFilter } from '../../../../libs/common/exceptions/filters/validation-http-exception.filter';
import { DomainHttpExceptionsFilter } from '../../../../libs/common/exceptions/filters/domain-http-exceptions.filter';
import { GlobalExceptionsFilter } from '../../../../libs/common/exceptions/filters/global-http-exceptions.filter';
import { FilesConfig } from '../files.config';

export function globalExceptionFilterSetup(app: INestApplication, config: FilesConfig) {
  app.useGlobalFilters(new GlobalExceptionsFilter(config));
  app.useGlobalFilters(new DomainHttpExceptionsFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());
}
