import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  type GlobalExceptionsFilterLogger,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { SnapFlowDomainExceptionCodeMapper } from '../common/exceptions/snapflow-domain-exception-mapper';
import { SnapFlowDomainExceptionCodeType } from '../common/exceptions/domain-exception-codes';
import { LoggerFactory } from '../modules/logger/logger.factory';

export async function globalExceptionFilterSetup(
  app: INestApplication,
  isExposeDetails: boolean,
): Promise<void> {
  const mapper: SnapFlowDomainExceptionCodeMapper = app.get(SnapFlowDomainExceptionCodeMapper);

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
  app.useGlobalFilters(new DomainHttpExceptionsFilter<SnapFlowDomainExceptionCodeType>(mapper));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
