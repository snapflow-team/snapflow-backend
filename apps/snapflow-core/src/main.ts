import { NestFactory } from '@nestjs/core';
import { initSnapFlowCoreAppModule } from './init-snap-flow-core-app-module';
import { SnapflowCoreConfig } from './snapflow-core.config';
import cookieParser from 'cookie-parser';

//todo: Добавить Swagger
async function bootstrap() {
  const DynamicAppModule = await initSnapFlowCoreAppModule();

  const app = await NestFactory.create(DynamicAppModule);

  // Настройка trust proxy для NestJS
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  // Подключаем cookie-parser глобально
  app.use(cookieParser());

  const coreConfig = app.get<SnapflowCoreConfig>(SnapflowCoreConfig);

  app.enableCors({
    origin: true,
    credentials: true, // ← важно для cookies
  });

  const port = coreConfig.port;

  await app.listen(port, () => {
    console.log('App starting listen port: ', port);
    console.log('NODE_ENV: ', coreConfig.env);
  });
}

void bootstrap();
