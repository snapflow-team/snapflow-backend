import { INestApplication } from '@nestjs/common';
import { LoggerFactory } from '../modules/logger/logger.factory';
import {
  GlobalExceptionsFilter,
  GlobalExceptionsFilterLogger,
} from '../../../../libs/exceptions/http/filters';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean): void {
  //TODO НАстроить exception filters, так как я не знаю какие ошибки будут летать на этом микросервисе
  const loggerFactory: LoggerFactory = app.get(LoggerFactory);
  const filterLogger = loggerFactory.create(GlobalExceptionsFilter.name);

  const globalFilterLogger: GlobalExceptionsFilterLogger = {
    error: (message: string, stack?: string): void => {
      const err = new Error(message);
      if (stack !== undefined && stack !== '') {
        err.stack = stack;
      }
      filterLogger.error(err, 'GlobalExceptionsFilter.logException');
    },
    warn: (message: string): void => {
      filterLogger.warn(message, 'GlobalExceptionsFilter.logException');
    },
  };

  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails, undefined, globalFilterLogger));
  //app.useGlobalFilters(new DomainHttpExceptionsFilter<SnapFlowDomainExceptionCodeType>(mapper));
  //app.useGlobalFilters(new ValidationExceptionFilter());
}
