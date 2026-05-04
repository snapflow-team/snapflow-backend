/* eslint-disable @typescript-eslint/no-require-imports -- New Relic must load before any other imports */
require('newrelic');
/* eslint-enable @typescript-eslint/no-require-imports */

import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { Express } from 'express';
import { applyAppInitialization } from './setup/app-initialization';
import { CustomLogger } from './modules/logger/logger.service';

async function bootstrap() {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule, {
    bufferLogs: true,
  });

  const appLogger: CustomLogger = await app.resolve(CustomLogger);
  appLogger.setContext('NEST_INIT');
  app.useLogger(appLogger);

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  const server: Express = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  await applyAppInitialization(app, appLogger);

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;

  await app.listen(port, () => {
    appLogger.log(`\x1b[35m=========================================\x1b[0m`, 'bootstrap');
    appLogger.log(`\x1b[36m✅ Application is running in ${env} mode\x1b[0m`, 'bootstrap');
    appLogger.log(`\x1b[36m📡 Server listening on port ${port}\x1b[0m`, 'bootstrap');
    appLogger.log(`\x1b[36m🌍 Environment: ${env}\x1b[0m`, 'bootstrap');
    appLogger.log(`\x1b[35m=========================================\x1b[0m`, 'bootstrap');
  });
}

void bootstrap();
