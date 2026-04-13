import { INestApplication } from '@nestjs/common';
import {
  DomainHttpExceptionsFilter,
  GlobalExceptionsFilter,
  ValidationExceptionFilter,
} from '../../../../libs/exceptions/http/filters';
import { NotificationResultCodeType } from '../common/notification/notification-result-code';
import { NotificationResultCodeMapper } from '../common/notification/notification-result-code.mapper';

export function globalExceptionFilterSetup(app: INestApplication, isExposeDetails: boolean) {
  const mapper: NotificationResultCodeMapper = app.get(NotificationResultCodeMapper);

  app.useGlobalFilters(new GlobalExceptionsFilter(isExposeDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter<NotificationResultCodeType>(mapper));
  app.useGlobalFilters(new ValidationExceptionFilter());
}
