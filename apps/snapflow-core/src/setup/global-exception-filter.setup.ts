import { INestApplication } from '@nestjs/common';
import { ValidationExceptionFilter } from '../../../../libs/exceptions/http/filters/validation-http-exception.filter';
import { DomainHttpExceptionsFilter } from '../../../../libs/exceptions/http/filters/domain-http-exceptions.filter';
import { GlobalExceptionsFilter } from '../../../../libs/exceptions/http/filters/global-http-exceptions.filter';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());
}
