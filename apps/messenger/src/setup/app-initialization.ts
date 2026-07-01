import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { ApiSettings } from './configuration/api-settings';
import { EnvironmentSettings } from './configuration/environment-settings';
import { SwaggerSettings } from './configuration/swagger-settings';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';
import { corsSetup } from './cors.setup';
import { globalPrefixSetup } from './global-prefix.setup';
import { swaggerSetup } from './swagger.setup';
import { cookieSetup } from './cookie.setup';
import { pipesSetup } from './pipes.setup';

export const applyAppInitialization = (app: INestApplication): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');
  const swaggerSettings: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');

  corsSetup(app, apiSettings.allowedOrigins);
  cookieSetup(app);
  pipesSetup(app);
  globalPrefixSetup(app);
  swaggerSetup(app, swaggerSettings, environmentSettings);
  globalExceptionFilterSetup(app, apiSettings.sendInternalServerErrorDetails);
};
