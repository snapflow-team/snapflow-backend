import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  type GlobalExceptionsFilterLogger,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { SnapFlowDomainExceptionCodeMapper } from '../common/exceptions/snapflow-domain-exception-mapper';
import { SnapFlowDomainExceptionCodeType } from '../common/exceptions/domain-exception-codes';
import { CustomLogger } from '../modules/logger/logger.service';

export async function globalExceptionFilterSetup(
  app: INestApplication,
  isExposeDetails: boolean,
): Promise<void> {
  const mapper: SnapFlowDomainExceptionCodeMapper = app.get(SnapFlowDomainExceptionCodeMapper);

  const filterLogger: CustomLogger = await app.resolve(CustomLogger);
  filterLogger.setContext(GlobalExceptionsFilter.name);

  const globalFilterLogger: GlobalExceptionsFilterLogger = {
    error: (message: string, stack?: string): void => {
      const err = new Error(message);
      if (stack !== undefined && stack !== '') {
        Object.defineProperty(err, 'stack', { value: stack, configurable: true });
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
