import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { SnapflowCoreConfig } from './snapflow-core.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { appSetup } from './setup/app.setup';

async function bootstrap() {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule);

  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  const coreConfig: SnapflowCoreConfig = app.get<SnapflowCoreConfig>(SnapflowCoreConfig);

  appSetup(app, coreConfig);

  const port: number = coreConfig.port;
  const env: string = coreConfig.env;

  await app.listen(port, () => {
    console.log('test');
    console.log('App starting listen port: ', port);
    console.log('NODE_ENV: ', env);
  });
}

void bootstrap();
