import { INestApplication } from '@nestjs/common';
import { ValidationExceptionFilter } from '../../../../libs/common/exceptions/filters/validation-http-exception.filter';
import { DomainHttpExceptionsFilter } from '../../../../libs/common/exceptions/filters/domain-http-exceptions.filter';
import { GlobalExceptionsFilter } from '../../../../libs/common/exceptions/filters/global-http-exceptions.filter';

// todo: вынести в либу
export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());
}
