import { NestFactory } from '@nestjs/core';
import { FilesModule } from './files.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { MicroserviceSettings } from './setup/configuration/microservice.settings';
import { applyAppInitialization } from './setup/app-initialization';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { printFilesStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(FilesModule);
  const configService = appContext.get<ConfigService<Configuration, true>>(ConfigService);

  const microserviceSettings: MicroserviceSettings =
    configService.get<MicroserviceSettings>('microserviceSettings');
  const env: string = configService.get<EnvironmentSettings>('environmentSettings').currentEnv;

  await appContext.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(FilesModule, {
    transport: Transport.TCP,
    options: {
      host: microserviceSettings.host,
      port: microserviceSettings.port,
    },
  });

  applyAppInitialization(app);

  await app.listen();

  const startedAt: string = new Date().toLocaleString();
  printFilesStartupBannerToConsole({
    env,
    host: microserviceSettings.host,
    port: microserviceSettings.port,
    startedAt,
  });
}

void bootstrap();
