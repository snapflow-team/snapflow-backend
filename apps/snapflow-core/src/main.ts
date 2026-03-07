import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from './setup/configuration/api-settings';
import { EnvironmentSettings } from './setup/configuration/environment-settings';
import { Configuration } from './setup/configuration/configuration';
import { Express } from 'express';
import { applyAppInitialization } from './setup/app-initialization';
import { ValidationPipe } from '@nestjs/common';
import { RpcValidationPipeFilter } from '../../../libs/exceptions/rpc/validation-rpc.filter';
import { RpcDomainExceptionFilter } from '../../../libs/exceptions/rpc/domain-rpc.filter';
import { GlobalRpcExceptionFilter } from '../../../libs/exceptions/rpc/global-rpc.filter';

async function bootstrap() {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(
    new RpcValidationPipeFilter(),
    new RpcDomainExceptionFilter(),
    new GlobalRpcExceptionFilter(),
  );

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

  await app.listen(port, () => {
    console.log(`\n✅ Application is running in ${env} mode`);
    console.log(`📡 Server listening on port ${port}`);
    console.log(`🌍 Environment: ${env}\n`);
  });
}

void bootstrap();
