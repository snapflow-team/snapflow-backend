import { INestApplication } from '@nestjs/common';
import { FilesConfig } from '../files.config';

export function corsSetup(app: INestApplication, config: FilesConfig) {
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
  });
}
