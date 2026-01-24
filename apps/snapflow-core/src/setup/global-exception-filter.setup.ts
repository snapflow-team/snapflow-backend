import { INestApplication } from '@nestjs/common';
import { SnapflowCoreConfig } from '../snapflow-core.config';
import { AllExceptionsFilter } from '../../../../libs/common/exceptions/filters/all-exceptions.filter';

export function globalExceptionFilterSetup(app: INestApplication, config: SnapflowCoreConfig) {
  app.useGlobalFilters(new AllExceptionsFilter(config));
}
