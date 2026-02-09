import { INestApplication } from '@nestjs/common';
import { SnapflowCoreConfig } from '../snapflow-core.config';
import { ValidationExceptionFilter } from '../../../../libs/common/exceptions/filters/validation-http-exception.filter';
import { DomainHttpExceptionsFilter } from '../../../../libs/common/exceptions/filters/domain-http-exceptions.filter';
import { GlobalExceptionsFilter } from '../../../../libs/common/exceptions/filters/global-http-exceptions.filter';

export function globalExceptionFilterSetup(app: INestApplication, config: SnapflowCoreConfig) {
  app.useGlobalFilters(new GlobalExceptionsFilter(config));
  app.useGlobalFilters(new DomainHttpExceptionsFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());
}
