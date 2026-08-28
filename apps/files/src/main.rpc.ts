import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { FilesRpcModule } from './files-rpc.module';
import { Configuration } from './setup/configuration/configuration';
import { MicroserviceSettings } from './setup/configuration/microservice.settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { applyRpcInitialization } from './setup/app-rpc-initialization';
import { printFilesStartupBannerToConsole } from './modules/logger/utils/startup-banner.util';
import { CustomLogger } from './modules/logger/logger.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(FilesRpcModule);
  const configService = appContext.get<ConfigService<Configuration, true>>(ConfigService);

  const microserviceSettings: MicroserviceSettings =
    configService.get<MicroserviceSettings>('microserviceSettings');
  const env: string = configService.get<EnvironmentSettings>('environmentSettings').currentEnv;

  await appContext.close();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(FilesRpcModule, {
    transport: Transport.TCP,
    bufferLogs: true,
    options: {
      host: microserviceSettings.host,
      port: microserviceSettings.port,
    },
  });

  app.useLogger(app.get(CustomLogger));
  applyRpcInitialization(app);

  await app.listen();

  const startedAt: string = new Date().toLocaleString();
  printFilesStartupBannerToConsole({
    env,
    mode: 'rpc',
    rpcPort: microserviceSettings.port,
    startedAt,
  });
}

void bootstrap();
