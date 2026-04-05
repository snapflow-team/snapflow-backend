import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { Express } from 'express';
import { applyAppInitialization } from './setup/app-initialization';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule);

  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const environmentSettings: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  const server: Express = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  applyAppInitialization(app);

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;

  // vilyamz: deploy

  await app.listen(port, () => {
    logger.log(`\x1b[35m=========================================\x1b[0m`);
    logger.log(`\x1b[36m✅ Application is running in ${env} mode\x1b[0m`);
    logger.log(`\x1b[36m📡 Server listening on port ${port}\x1b[0m`);
    logger.log(`\x1b[36m🌍 Environment: ${env}\x1b[0m`);
    logger.log(`\x1b[35m=========================================\x1b[0m`);
  });
}

void bootstrap();
