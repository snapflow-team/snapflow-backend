import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { PaymentsDomainExceptionCodeType } from '../common/exceptions/domain-exception-codes';
import { PaymentsDomainExceptionCodeMapper } from '../common/exceptions/payments-domain-exception-mapper';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  const mapper: PaymentsDomainExceptionCodeMapper = app.get(PaymentsDomainExceptionCodeMapper);

  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter<PaymentsDomainExceptionCodeType>(mapper));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
