import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { Express } from 'express';
import { applyAppInitialization } from './setup/app-initialization';

async function bootstrap() {
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
  // vilyamz: test
  applyAppInitialization(app);

  const port: number = apiSettings.port;
  const env: string = environmentSettings.currentEnv;

  await app.listen(port, () => {
    console.log(`\n✅ Application is running in ${env} mode`);
    console.log(`📡 Server listening on port ${port}`);
    console.log(`🌍 Environment: ${env}\n`);
  });
}

void bootstrap();
