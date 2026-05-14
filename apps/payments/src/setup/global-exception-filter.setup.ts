import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  type GlobalExceptionsFilterLogger,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { NotificationResultCodeType } from '../common/notification/notification-result-code';
import { NotificationResultCodeMapper } from '../common/notification/notification-result-code.mapper';
import { LoggerFactory } from '../modules/logger/logger.factory';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  const mapper: NotificationResultCodeMapper = app.get(NotificationResultCodeMapper);

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
  app.useGlobalFilters(new DomainHttpExceptionsFilter<NotificationResultCodeType>(mapper));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
