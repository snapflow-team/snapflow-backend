import { INestApplication } from '@nestjs/common';

export function corsSetup(app: INestApplication, origin: string[] | boolean) {
  app.enableCors({
    origin,
    credentials: true, // ← важно для cookies
  });
}
