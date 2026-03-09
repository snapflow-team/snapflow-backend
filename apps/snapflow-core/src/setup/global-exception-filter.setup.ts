import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { SnapFlowDomainExceptionCodeMapper } from '../common/exceptions/snapflow-domain-exception-mapper';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter(new SnapFlowDomainExceptionCodeMapper()));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
