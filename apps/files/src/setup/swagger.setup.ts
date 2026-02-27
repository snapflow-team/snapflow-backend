import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { FilesConfig } from '../files.config';

export function swaggerSetup(app: INestApplication, config: FilesConfig) {
  if (!config.isSwaggerEnabled) {
    return;
  }

  const swaggerConfig = new DocumentBuilder()
    .setVersion('1.0')
    .setTitle('Snapflow Files API')
    .setDescription('API documentation for files service.')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Access Token for files endpoints.',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Files', 'File upload and validation')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(`${GLOBAL_PREFIX}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Snapflow Files Documentation',
  });
}
