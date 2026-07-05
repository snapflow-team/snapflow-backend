import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import expressBasicAuth from 'express-basic-auth';
import { SwaggerSettings } from './configuration/swagger-settings';
import { EnvironmentSettings } from './configuration/environment-settings';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import type { RequestHandler } from 'express';

export function swaggerSetup(
  app: INestApplication,
  swaggerSettings: SwaggerSettings,
  environmentSettings: EnvironmentSettings,
) {
  const { swaggerUser, swaggerPassword, swaggerPath } = swaggerSettings;
  const fullSwaggerPath = `/${GLOBAL_PREFIX}/${swaggerPath}`;

  if (!environmentSettings.isDevelopment) {
    const authMiddleware: RequestHandler = expressBasicAuth({
      challenge: true,
      users: { [swaggerUser]: swaggerPassword },
    });

    app.use(fullSwaggerPath, authMiddleware);
  }

  const config: DocumentBuilder = new DocumentBuilder()
    .setTitle('SnapFlow API')
    .setVersion('1.0.0')
    .setDescription('REST API для messenger microservice')
    .addCookieAuth(
      'refreshToken',
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'Refresh Token хранится в httpOnly cookie',
      },
      'refresh-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access Token для обычных пользователей. Отправляется в Authorization header',
      },
      'access-token',
    )
    .addTag('Auth', 'Методы аутентификации')
    .addTag('OAuth', 'Методы аутентификации через сторонние сервисы')
    .addTag('Profile', 'Управление профилями пользователей')
    .addTag('Sessions', 'Управление сессиями на разных устройствах');

  const coreDocument: OpenAPIObject = SwaggerModule.createDocument(app, config.build());
  const swaggerOptions: Record<string, unknown> = {
    persistAuthorization: true,
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    deepLinking: true,
    tryItOutEnabled: true,
    displayOperationId: false,
    displayRequestDuration: true,
  };
  if (swaggerSettings.paymentsSwaggerUrl) {
    swaggerOptions.urls = [
      { url: `/${GLOBAL_PREFIX}/${swaggerPath}-json`, name: 'SnapFlow Core' },
      { url: swaggerSettings.paymentsSwaggerUrl, name: 'Payments' },
    ];
    swaggerOptions['urls.primaryName'] = 'SnapFlow Core';
  }

  SwaggerModule.setup(fullSwaggerPath, app, coreDocument, {
    explorer: Boolean(swaggerSettings.paymentsSwaggerUrl),
    swaggerOptions,
    customSiteTitle: 'Snapflow Documentation',
    customCss: '.swagger-ui .info .url { display: none !important; }',
  });
}
