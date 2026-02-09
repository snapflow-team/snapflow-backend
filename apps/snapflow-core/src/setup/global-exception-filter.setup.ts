import { INestApplication } from '@nestjs/common';
import { SnapflowCoreConfig } from '../snapflow-core.config';
import { GlobalExceptionsFilter } from '../../../../libs/common/exceptions/filters/global-http-exceptions.filter';
import { ValidationExceptionFilter } from '../../../../libs/common/exceptions/filters/validation-http-exception.filter';
import { DomainHttpExceptionsFilter } from '../../../../libs/common/exceptions/filters/domain-http-exceptions.filter';

export function globalExceptionFilterSetup(app: INestApplication, config: SnapflowCoreConfig) {
  app.useGlobalFilters(
    new ValidationExceptionFilter(),
    new DomainHttpExceptionsFilter(),
    new GlobalExceptionsFilter(config),
  );
}
