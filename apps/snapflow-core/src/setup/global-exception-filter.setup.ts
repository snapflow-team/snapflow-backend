import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { SnapFlowDomainExceptionCodeMapper } from '../common/exceptions/snapflow-domain-exception-mapper';
import { SnapFlowDomainExceptionCodeType } from '../common/exceptions/domain-exception-codes';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(
    new DomainHttpExceptionsFilter<SnapFlowDomainExceptionCodeType>(
      new SnapFlowDomainExceptionCodeMapper(),
    ),
  );
  app.useGlobalFilters(new ValidationExceptionFilter());
}
