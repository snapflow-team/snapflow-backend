import { INestApplication } from '@nestjs/common';
import { SnapflowCoreConfig } from '../snapflow-core.config';

export function corsSetup(app: INestApplication, config: SnapflowCoreConfig) {
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true, // ← важно для cookies
  });
}
