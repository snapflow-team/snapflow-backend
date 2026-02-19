import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { SnapflowCoreConfig } from './snapflow-core.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { appSetup } from './setup/app.setup';

export async function createApp(): Promise<NestExpressApplication> {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create<NestExpressApplication>(DynamicAppModule);

  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  const coreConfig: SnapflowCoreConfig = app.get<SnapflowCoreConfig>(SnapflowCoreConfig);

  appSetup(app, coreConfig);

  return app;
}
