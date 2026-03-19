import { INestMicroservice } from '@nestjs/common';
import { GlobalRpcExceptionFilter } from '../../../../libs/exceptions/rpc/filters/global-rpc-exception.filter';
import { DomainRpcExceptionsFilter } from '../../../../libs/exceptions/rpc/filters/domain-rpc-exception.filter';
import { ValidationRpcExceptionFilter } from '../../../../libs/exceptions/rpc/filters/validation-rpc-exception.filter';
import { EnvironmentSettings } from './configuration/environment-settings';
import { SERVICES } from '../../../../libs/contracts/services.tokens';

export function globalExceptionFilterSetup(
  app: INestMicroservice,
  environmentSettings: EnvironmentSettings,
) {
  app.useGlobalFilters(new GlobalRpcExceptionFilter(SERVICES.FILES, environmentSettings));
  app.useGlobalFilters(new DomainRpcExceptionsFilter(SERVICES.FILES));
  app.useGlobalFilters(new ValidationRpcExceptionFilter(SERVICES.FILES));
}
