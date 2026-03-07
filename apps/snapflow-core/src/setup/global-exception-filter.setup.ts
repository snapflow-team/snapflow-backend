import { INestApplication } from '@nestjs/common';
import { ValidationExceptionFilter } from '../../../../libs/exceptions/filters/http/validation-http-exception.filter';
import { DomainHttpExceptionsFilter } from '../../../../libs/exceptions/filters/http/domain-http-exceptions.filter';
import { GlobalExceptionsFilter } from '../../../../libs/exceptions/filters/http/global-http-exceptions.filter';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());
}
