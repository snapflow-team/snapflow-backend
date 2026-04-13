import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { ApiSettings } from './configuration/api-settings';
import { EnvironmentSettings } from './configuration/environment-settings';
import { SwaggerSettings } from './configuration/swagger-settings';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';
import { corsSetup } from './cors.setup';
import { globalPrefixSetup } from './global-prefix.setup';
import { pipesSetup } from '../../../snapflow-core/src/setup/pipes.setup';
import { cookieSetup } from '../../../snapflow-core/src/setup/cookie.setup';
import { swaggerSetup } from './swagger.setup';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

export const applyAppInitialization = (app: INestApplication): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const swaggerSettings: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  corsSetup(app, apiSettings.allowedOrigins);
  cookieSetup(app);
  pipesSetup(app);
  globalPrefixSetup(app);
  swaggerSetup(app, swaggerSettings, environmentSettings);
  globalExceptionFilterSetup(app, apiSettings.sendInternalServerErrorDetails);

  if (environmentSettings.isDevelopment) {
    console.log(
      `📚 Swagger (payments, только публичные методы): http://localhost:${apiSettings.port}/${GLOBAL_PREFIX}/${swaggerSettings.swaggerPath}`,
    );
  }
};
