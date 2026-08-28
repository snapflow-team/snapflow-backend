import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { IngestApiSettings } from './configuration/ingest-api-settings';
import { corsSetup } from './cors.setup';
import { globalPrefixSetup } from './global-prefix.setup';
import { httpPipesSetup } from './http-pipes.setup';
import { httpGlobalExceptionFilterSetup } from './http-global-exception-filter.setup';

export const applyHttpInitialization = (app: INestApplication): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );
  const ingestApiSettings: IngestApiSettings =
    configService.get<IngestApiSettings>('ingestApiSettings');

  corsSetup(app, ingestApiSettings.allowedOrigins);
  globalPrefixSetup(app);
  httpPipesSetup(app);
  httpGlobalExceptionFilterSetup(app, ingestApiSettings.sendInternalServerErrorDetails);
};
