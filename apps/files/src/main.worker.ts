import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FilesWorkerModule } from './files-worker.module';
import { Configuration } from './setup/configuration/configuration';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { printFilesStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';
import { CustomLogger } from './modules/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(FilesWorkerModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(CustomLogger));

  const configService = app.get<ConfigService<Configuration, true>>(ConfigService);
  const env: string = configService.get<EnvironmentSettings>('environmentSettings').currentEnv;

  const startedAt: string = new Date().toLocaleString();
  printFilesStartupBannerToConsole({
    env,
    mode: 'worker',
    startedAt,
  });
}

void bootstrap();
