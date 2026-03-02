import { INestApplication } from '@nestjs/common';
import { EnvironmentSettings } from './configuration/environment-settings';
import { SwaggerSettings } from './configuration/swagger-settings';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { ApiSettings } from './configuration/api-settings';
import { globalPrefixSetup } from './global-prefix.setup';
import { cookieSetup } from './cookie.setup';
import { pipesSetup } from './pipes.setup';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { corsSetup } from './cors.setup';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';

export const applyAppInitialization = (app: INestApplication): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const swaggerSettings: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');
  const envSetting: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  corsSetup(app, apiSettings.allowedOrigins);

  cookieSetup(app);

  pipesSetup(app);

  globalPrefixSetup(app);

  globalExceptionFilterSetup(app, apiSettings.sendInternalServerErrorDetails);

  if (envSetting.isDevelopment) {
    console.log('🚀 Development mode enabled');
    console.log(
      `📚 Swagger available at: http://localhost:${apiSettings.port}/${GLOBAL_PREFIX}/${swaggerSettings.swaggerPath}`,
    );
  }
};
