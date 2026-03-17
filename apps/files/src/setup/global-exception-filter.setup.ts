import { INestMicroservice } from '@nestjs/common';
import { GlobalRpcExceptionFilter } from '../../../../libs/exceptions/rpc/filters/global-rpc-exception.filter';
import { DomainRpcExceptionsFilter } from '../../../../libs/exceptions/rpc/filters/domain-rpc-exception.filter';
import { ValidationRpcExceptionFilter } from '../../../../libs/exceptions/rpc/filters/validation-rpc-exception.filter';

export function globalExceptionFilterSetup(app: INestMicroservice, isExposeDetails: boolean) {
  // todo: вынести 'Files' в enum
  app.useGlobalFilters(new GlobalRpcExceptionFilter('Files', isExposeDetails));
  app.useGlobalFilters(new DomainRpcExceptionsFilter('Files'));
  app.useGlobalFilters(new ValidationRpcExceptionFilter('Files'));
}
