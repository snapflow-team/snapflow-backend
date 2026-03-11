import { INestMicroservice } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './configuration/configuration';
import { pipesSetup } from './pipes.setup';
import { globalExceptionFilterSetup } from './global-exception-filter.setup';
import { MicroserviceSettings } from './configuration/microservice.settings';

export const applyAppInitialization = (app: INestMicroservice): void => {
  const configService: ConfigService<Configuration, true> = app.get(
    ConfigService<Configuration, true>,
  );

  const microserviceSettings: MicroserviceSettings =
    configService.get<MicroserviceSettings>('microserviceSettings');

  pipesSetup(app);

  globalExceptionFilterSetup(app, microserviceSettings.sendInternalServerErrorDetails);
};
