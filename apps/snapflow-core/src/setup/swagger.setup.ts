import { INestApplication } from '@nestjs/common';
import { SnapflowCoreConfig } from '../snapflow-core.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

export function swaggerSetup(app: INestApplication, config: SnapflowCoreConfig) {
  //todo: нужно ли скрывать сваггер в проде??
  // if (config.env === 'production') {
  //   return;
  // }

  const swaggerConfig = new DocumentBuilder()
    .setVersion('1.0')
    .setTitle('Snapflow API')
    .setDescription('Документация API для Snapflow.')
    .addCookieAuth(
      'refreshToken',
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Refresh Token хранится в httpOnly cookie',
      },
      'refresh-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Access Token для обычных пользователей. Отправляется в Authorization header',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', 'Методы аутентификации')
    .addTag('Users', 'Управление пользователями')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Snapflow Documentation',
  });

  if (config.env === 'development') {
    console.log(`🚀 Swagger is running on: http://localhost:${config.port}/docs`);
  }
}
