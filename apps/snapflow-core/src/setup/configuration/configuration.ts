import { Environments } from '../../../../../libs/common/enums/enviroments.enum';
import * as dotenv from 'dotenv';
import { ValidateNested, validateSync } from 'class-validator';
import { ApiSettings } from './api-settings';
import { ValidationError } from '@nestjs/common';
import { BusinessRulesSettings } from './business-rules-settings';
import { EnvironmentSettings } from './environment-settings';
import { DatabaseSettings } from './database-settings';
import { SwaggerSettings } from './swagger-settings';

export type EnvironmentVariable = { [key: string]: string };

export const loadEnv = (): string[] => {
  const env = process.env.NODE_ENV as Environments;

  switch (env) {
    case Environments.Development: {
      return ['src/env/.env.development.local', 'src/env/.env.development'];
    }

    case Environments.Testing: {
      return ['src/env/.env.testing.local', 'src/env/.env.testing'];
    }

    default: {
      return ['src/env/.env'];
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
  swaggerSettings: SwaggerSettings;

  @ValidateNested()
  environmentSettings: EnvironmentSettings;

  @ValidateNested()
  businessRulesSettings: BusinessRulesSettings;

  private constructor(configuration: Configuration) {
    Object.assign(this, configuration);
  }

  static createConfig(environmentVariables: EnvironmentVariable): Configuration {
    return new this({
      apiSettings: new ApiSettings(environmentVariables),
      databaseSettings: new DatabaseSettings(environmentVariables),
      swaggerSettings: new SwaggerSettings(environmentVariables),
      environmentSettings: new EnvironmentSettings(environmentVariables),
      businessRulesSettings: new BusinessRulesSettings(environmentVariables),
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
