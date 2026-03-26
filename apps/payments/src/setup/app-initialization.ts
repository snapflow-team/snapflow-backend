import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { ApiSettings } from './configuration/api-settings';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';
import { corsSetup } from './cors.setup';
import { globalPrefixSetup } from './global-prefix.setup';

export const applyAppInitialization = (app: INestApplication): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');

  corsSetup(app, apiSettings.allowedOrigins);
  globalPrefixSetup(app);
  globalExceptionFilterSetup(app, apiSettings.sendInternalServerErrorDetails);
};
