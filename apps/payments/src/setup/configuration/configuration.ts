import { Environments } from '../../../../../libs/common/enums/enviroments.enum';
import * as dotenv from 'dotenv';
import { ValidateNested, validateSync } from 'class-validator';
import { ApiSettings } from './api-settings';
import { ValidationError } from '@nestjs/common';
import { EnvironmentSettings } from './environment-settings';
import { DatabaseSettings } from './database-settings';
import { BusinessRulesSettings } from './business-rules-settings';
import { SwaggerSettings } from './swagger-settings';
import { LoggerSettings } from './logger-settings';

export type EnvironmentVariable = { [key: string]: string };

export const loadEnv = (): string[] => {
  const env = process.env.NODE_ENV as Environments;

  switch (env) {
    case Environments.Development: {
      return ['apps/payments/env/.env.development.local', 'apps/payments/env/.env.development'];
    }

    case Environments.Testing: {
      return ['apps/payments/env/.env.testing.local', 'apps/payments/env/.env.testing'];
    }

    default: {
      return ['apps/payments/env/.env'];
    }
  }
};

dotenv.config({ path: loadEnv() });

export class Configuration {
  @ValidateNested()
  apiSettings: ApiSettings;

  @ValidateNested()
  databaseSettings: DatabaseSettings;

  @ValidateNested()
  businessRulesSettings: BusinessRulesSettings;

  @ValidateNested()
  environmentSettings: EnvironmentSettings;

  @ValidateNested()
  swaggerSettings: SwaggerSettings;

  @ValidateNested()
  loggerSettings: LoggerSettings;

  private constructor(configuration: Configuration) {
    Object.assign(this, configuration);
  }

  static createConfig(environmentVariables: EnvironmentVariable): Configuration {
    return new this({
      apiSettings: new ApiSettings(environmentVariables),
      databaseSettings: new DatabaseSettings(environmentVariables),
      businessRulesSettings: new BusinessRulesSettings(environmentVariables),
      environmentSettings: new EnvironmentSettings(environmentVariables),
      swaggerSettings: new SwaggerSettings(environmentVariables),
      loggerSettings: new LoggerSettings(environmentVariables),
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
