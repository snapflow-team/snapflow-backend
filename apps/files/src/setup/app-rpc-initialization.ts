import { INestApplication, INestMicroservice } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { pipesSetup } from './pipes.setup';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';
import { EnvironmentSettings } from './configuration/environment-settings';

export const applyRpcInitialization = (app: INestApplication | INestMicroservice): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );

  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  pipesSetup(app);
  globalExceptionFilterSetup(app, environmentSettings);
};
