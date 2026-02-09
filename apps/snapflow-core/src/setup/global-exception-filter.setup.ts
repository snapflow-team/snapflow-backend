import { INestApplication } from '@nestjs/common';
import { SnapflowCoreConfig } from '../snapflow-core.config';
import { AllHttpExceptionsFilter } from '../../../../libs/common/exceptions/filters/global-http-exceptions.filter';

export function globalExceptionFilterSetup(app: INestApplication, config: SnapflowCoreConfig) {
  app.useGlobalFilters(new AllHttpExceptionsFilter(config));
}
