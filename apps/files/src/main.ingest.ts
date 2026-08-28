import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FilesIngestModule } from './files-ingest.module';
import { Configuration } from './setup/configuration/configuration';
import { IngestApiSettings } from './setup/configuration/ingest-api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { applyHttpInitialization } from './setup/app-http-initialization';
import { printFilesStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';
import { CustomLogger } from './modules/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(FilesIngestModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(CustomLogger));
  applyHttpInitialization(app);

  const configService = app.get<ConfigService<Configuration, true>>(ConfigService);
  const ingestApiSettings: IngestApiSettings =
    configService.get<IngestApiSettings>('ingestApiSettings');
  const env: string = configService.get<EnvironmentSettings>('environmentSettings').currentEnv;

  await app.listen(ingestApiSettings.port, () => {
    const startedAt: string = new Date().toLocaleString();
    printFilesStartupBannerToConsole({
      env,
      mode: 'ingest',
      httpPort: ingestApiSettings.port,
      startedAt,
    });
  });
}

void bootstrap();
