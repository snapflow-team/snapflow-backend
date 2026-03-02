import { IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class SwaggerSettings {
  @IsString()
  swaggerUser: string;

  @IsString()
  swaggerPassword: string;

  @IsString()
  swaggerPath: string;

  constructor(private environmentVariables: EnvironmentVariable) {
    this.swaggerUser = this.environmentVariables.SWAGGER_USER;
    this.swaggerPassword = this.environmentVariables.SWAGGER_PASSWORD;
    this.swaggerPath = this.environmentVariables.SWAGGER_PATH;
  }
}
