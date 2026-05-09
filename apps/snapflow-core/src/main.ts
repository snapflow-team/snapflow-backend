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
import { SwaggerSettings } from './setup/configuration/swagger-settings';
import { GLOBAL_PREFIX } from '../../../libs/common/constants/global-prefix.constant';
import { printSnapflowStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';

async function bootstrap() {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule, {
    bufferLogs: true,
  });

  const appLogger: CustomLogger = app.get(CustomLogger);
  app.useLogger(appLogger);

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');
  const { port, publicApiBaseUrl }: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const { swaggerPath }: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');

  const server: Express = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  await applyAppInitialization(app);

  const env: string = environmentSettings.currentEnv;
  const swaggerDocUrl: string = `${publicApiBaseUrl}/${GLOBAL_PREFIX}/${swaggerPath}`;
  const showSwaggerInBanner: boolean =
    environmentSettings.isDevelopment || environmentSettings.isStaging;

  await app.listen(port, () => {
    const startedAt: string = new Date().toLocaleString();
    printSnapflowStartupBannerToConsole({
      env,
      port,
      swaggerDocUrl,
      startedAt,
      showSwagger: showSwaggerInBanner,
    });
  });
}

void bootstrap();
