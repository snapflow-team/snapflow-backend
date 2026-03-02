import { INestApplication } from '@nestjs/common';
import { EnvironmentSettings } from './configuration/environment-settings';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { SwaggerSettings } from './configuration/swagger-settings';
import expressBasicAuth from 'express-basic-auth';
import { RequestHandler } from 'express';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { ApiSettings } from './configuration/api-settings';
import { globalPrefixSetup } from './global-prefix.setup';
import { cookieSetup } from './cookie.setup';
import { pipesSetup } from './pipes.setup';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

const setupSwagger = (
  app: INestApplication,
  swaggerSettings: SwaggerSettings,
  environmentSettings: EnvironmentSettings,
): void => {
  const { swaggerUser, swaggerPassword, swaggerPath } = swaggerSettings;

  if (!environmentSettings.isDevelopment) {
    const authMiddleware: RequestHandler = expressBasicAuth({
      challenge: true,
      users: { [swaggerUser]: swaggerPassword },
    });

    app.use(`/${swaggerPath}`, authMiddleware);
  }

  const config: DocumentBuilder = new DocumentBuilder()
    .setTitle('SnapFlow API')
    .setVersion('1.0.0')
    .setDescription('REST API для SnapFlow')
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
    .addTag('OAuth', 'Методы аутентификации через сторонние сервисы')
    .addTag('Profile', 'Управление профилями пользователей')
    .addTag('Sessions', 'Управление сессиями на разных устройствах');

  const document: OpenAPIObject = SwaggerModule.createDocument(app, config.build());
  SwaggerModule.setup(swaggerPath, app, document, {
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
    customSiteTitle: 'Snapflow Documentation',
  });
};

export const applyAppInitialization = (app: INestApplication): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
  const swaggerSettings: SwaggerSettings = configService.get<SwaggerSettings>('swaggerSettings');
  const envSetting: EnvironmentSettings =
    configService.get<EnvironmentSettings>('environmentSettings');

  // app.enableCors();
  // corsSetup(app, apiSettings.allowedOriginsRaw);

  // app.use(cookieParser());
  cookieSetup(app);

  // setupValidationPipe(app)
  pipesSetup(app);

  // app.setGlobalPrefix(GLOBAL_PREFIX);
  globalPrefixSetup(app);

  setupSwagger(app, swaggerSettings, envSetting);

  // setupExceptionFilters(app, apiSettings.SEND_INTERNAL_SERVER_ERROR_DETAILS);
  // globalExceptionFilterSetup(app, apiSettings.sendInternalServerErrorDetails);

  if (envSetting.isDevelopment) {
    console.log('🚀 Development mode enabled');
    console.log(
      `📚 Swagger available at: http://localhost:${apiSettings.port}/${GLOBAL_PREFIX}/${swaggerSettings.swaggerPath}`,
    );
  }
};
