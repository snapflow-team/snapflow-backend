import { INestApplication } from '@nestjs/common';
import { LoggerFactory } from '../modules/logger/logger.factory';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  GlobalExceptionsFilterLogger,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { MessengerResultCodeMapper } from '../common/notification/messenger-result-code.mapper';
import { MessengerResultCodeType } from '../common/notification/messenger-result-code';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean): void {
  const mapper: MessengerResultCodeMapper = app.get(MessengerResultCodeMapper);
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
  app.useGlobalFilters(new DomainHttpExceptionsFilter<MessengerResultCodeType>(mapper));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
