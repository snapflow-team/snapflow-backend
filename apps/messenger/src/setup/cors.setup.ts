import { INestApplication } from '@nestjs/common';

export function corsSetup(app: INestApplication, origin: string[] | boolean) {
  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
