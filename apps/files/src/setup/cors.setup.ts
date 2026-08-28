import { INestApplication } from '@nestjs/common';

export function corsSetup(app: INestApplication, origin: string[] | boolean) {
  app.enableCors({
    origin,
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Upload-Offset',
      'Upload-Length',
      'Tus-Resumable',
      'X-Request-Id',
    ],
  });
}
