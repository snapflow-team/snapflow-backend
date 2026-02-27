import { NestFactory } from '@nestjs/core';
import { FilesModule } from './files.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { appSetup } from './setup/app.setup';
import { FilesConfig } from './files.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(FilesModule);
  const server = app.getHttpAdapter().getInstance();
  server.set('trust proxy', true);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: 3002,
    },
  });

  const filesConfig: FilesConfig = app.get<FilesConfig>(FilesConfig);

  appSetup(app, filesConfig);

  await app.startAllMicroservices();
  await app.listen(filesConfig.port, () => {
    console.log('Files HTTP running on port:', filesConfig.port);
    console.log('Files microservice running on port: 3002');
    console.log('NODE_ENV:', filesConfig.env);
  });
}

void bootstrap();
