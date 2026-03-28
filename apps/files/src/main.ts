import { NestFactory } from '@nestjs/core';
import { FilesModule } from './files.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { MicroserviceSettings } from './setup/configuration/microservice.settings';
import { applyAppInitialization } from './setup/app-initialization';
import { Logger } from '@nestjs/common';
import { EnvironmentSettings } from './setup/configuration/environment-settings';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

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

  logger.log(`\x1b[35m=========================================\x1b[0m`);
  logger.log(`\x1b[36m✅ Microservice is running in ${env} mode\x1b[0m`);
  logger.log(
    `\x1b[36m📦 Files microservice running on ${microserviceSettings.host}:${microserviceSettings.port}\x1b[0m`,
  );
  logger.log(`\x1b[36m🌍 Environment: ${env}\x1b[0m`);
  logger.log(`\x1b[35m=========================================\x1b[0m`);
}

void bootstrap();
