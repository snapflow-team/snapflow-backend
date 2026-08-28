import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  type GlobalExceptionsFilterLogger,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { LoggerFactory } from '../modules/logger/logger.factory';
import { StorageDomainExceptionCodeMapper } from '../modules/storage/domain/errors/storage-domain-exception-mapper';

export function httpGlobalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  const mapper = new StorageDomainExceptionCodeMapper();
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
  app.useGlobalFilters(new DomainHttpExceptionsFilter(mapper));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
