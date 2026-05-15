import { INestMicroservice } from '@nestjs/common';
import { GlobalRpcExceptionFilter } from '../../../../libs/exceptions/rpc/filters/global-rpc-exception.filter';
import { DomainRpcExceptionsFilter } from '../../../../libs/exceptions/rpc/filters/domain-rpc-exception.filter';
import { ValidationRpcExceptionFilter } from '../../../../libs/exceptions/rpc/filters/validation-rpc-exception.filter';
import { EnvironmentSettings } from './configuration/environment-settings';
import { SERVICES } from '../../../../libs/contracts/services.tokens';
import { LoggerFactory } from '../modules/logger/logger.factory';

export function globalExceptionFilterSetup(
  app: INestMicroservice,
  environmentSettings: EnvironmentSettings,
) {
  const loggerFactory: LoggerFactory = app.get(LoggerFactory);
  const filterLogger = loggerFactory.create(GlobalRpcExceptionFilter.name);

  app.useGlobalFilters(
    new GlobalRpcExceptionFilter(SERVICES.FILES, environmentSettings, {
      error: (message: string, stack?: string): void => {
        const err = new Error(message);
        if (stack !== undefined && stack !== '') {
          err.stack = stack;
        }
        filterLogger.error(err, 'GlobalRpcExceptionFilter.logException');
      },
      warn: (message: string): void => {
        filterLogger.warn(message, 'GlobalRpcExceptionFilter.logException');
      },
    }),
  );
  app.useGlobalFilters(new DomainRpcExceptionsFilter(SERVICES.FILES));
  app.useGlobalFilters(new ValidationRpcExceptionFilter(SERVICES.FILES));
}
