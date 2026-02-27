import { INestApplication } from '@nestjs/common';
import { FilesConfig } from '../files.config';
import { corsSetup } from './cors.setup';
import { cookieSetup } from './cookie.setup';
import { pipesSetup } from './pipes.setup';
import { swaggerSetup } from './swagger.setup';
import { globalPrefixSetup } from './global-prefix.setup';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';

export function appSetup(app: INestApplication, config: FilesConfig) {
  corsSetup(app, config);
  cookieSetup(app);
  pipesSetup(app);
  globalPrefixSetup(app);
  swaggerSetup(app, config);
  globalExceptionFilterSetup(app, config);
}
