import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import expressBasicAuth from 'express-basic-auth';
import { SwaggerSettings } from './configuration/swagger-settings';
import { EnvironmentSettings } from './configuration/environment-settings';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import type { RequestHandler } from 'express';
import { MessagingModule } from '../modules/messaging/messaging.module';

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

  const config = new DocumentBuilder()
    .setTitle('SnapFlow Messenger API')
    .setVersion('1.0.0')
    .setDescription(
      'Публичное HTTP API сервиса мессенджера: чаты, история сообщений и отправка сообщений.',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token пользователя (тот же JWT, что для core API). Заголовок Authorization: Bearer …',
      },
      'access-token',
    )
    .addTag('Messenger', 'Чаты, история и обмен сообщениями')
    .build();

  const document: OpenAPIObject = SwaggerModule.createDocument(app, config, {
    include: [MessagingModule],
  });

  SwaggerModule.setup(fullSwaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      deepLinking: true,
      tryItOutEnabled: true,
      displayOperationId: false,
      displayRequestDuration: true,
    },
    customSiteTitle: 'SnapFlow Messenger API',
  });
}
