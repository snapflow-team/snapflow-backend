import { Environments } from '../../../../../libs/common/enums/enviroments.enum';
import * as dotenv from 'dotenv';
import { ValidateNested, validateSync } from 'class-validator';
import { ValidationError } from '@nestjs/common';
import { EnvironmentSettings } from './environment-settings';
import { DatabaseSettings } from './database-settings';
import { MicroserviceSettings } from './microservice.settings';
import { S3Settings } from './s3.settings';
import { LoggerSettings } from './logger-settings';
import { IngestApiSettings } from './ingest-api-settings';
import { StorageSettings } from './storage-settings';
import { StorageQueueSettings } from './storage-queue-settings';
import { ClamAvSettings } from './clam-av-settings';
import { MediaProcessingSettings } from './media-processing-settings';

export type EnvironmentVariable = { [key: string]: string };

export const loadEnv = (): string[] => {
  const env = process.env.NODE_ENV as Environments;

  switch (env) {
    case Environments.Development: {
      return ['apps/files/env/.env.development.local', 'apps/files/env/.env.development'];
    }

    case Environments.Testing: {
      return ['apps/files/env/.env.testing.local', 'apps/files/env/.env.testing'];
    }

    default: {
      return ['apps/files/env/.env'];
    }
  }
};

dotenv.config({ path: loadEnv() });

export class Configuration {
  @ValidateNested()
  environmentSettings: EnvironmentSettings;

  @ValidateNested()
  databaseSettings: DatabaseSettings;

  @ValidateNested()
  microserviceSettings: MicroserviceSettings;

  @ValidateNested()
  s3Settings: S3Settings;

  @ValidateNested()
  loggerSettings: LoggerSettings;

  @ValidateNested()
  ingestApiSettings: IngestApiSettings;

  @ValidateNested()
  storageSettings: StorageSettings;

  @ValidateNested()
  storageQueueSettings: StorageQueueSettings;

  @ValidateNested()
  clamAvSettings: ClamAvSettings;

  @ValidateNested()
  mediaProcessingSettings: MediaProcessingSettings;

  private constructor(configuration: Configuration) {
    Object.assign(this, configuration);
  }

  static createConfig(environmentVariables: EnvironmentVariable): Configuration {
    return new this({
      environmentSettings: new EnvironmentSettings(environmentVariables),
      databaseSettings: new DatabaseSettings(environmentVariables),
      microserviceSettings: new MicroserviceSettings(environmentVariables),
      s3Settings: new S3Settings(environmentVariables),
      loggerSettings: new LoggerSettings(environmentVariables),
      ingestApiSettings: new IngestApiSettings(environmentVariables),
      storageSettings: new StorageSettings(environmentVariables),
      storageQueueSettings: new StorageQueueSettings(environmentVariables),
      clamAvSettings: new ClamAvSettings(environmentVariables),
      mediaProcessingSettings: new MediaProcessingSettings(environmentVariables),
    });
  }
}

export function validate(environmentVariables: EnvironmentVariable) {
  const config: Configuration = Configuration.createConfig(environmentVariables);
  const errors: ValidationError[] = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return config;
}

export default () => {
  const environmentVariables = process.env as EnvironmentVariable;
  return Configuration.createConfig(environmentVariables);
};
