import { EnvironmentVariable } from './configuration';
import { Environments } from '../../../../../libs/common/enums/enviroments.enum';
import { IsEnum } from 'class-validator';

// todo: вынести в либу
export class EnvironmentSettings {
  @IsEnum(Environments)
  private readonly NODE_ENV: Environments;

  constructor(private environmentVariables: EnvironmentVariable) {
    this.NODE_ENV = this.environmentVariables.NODE_ENV as Environments;
  }

  get isProduction() {
    return this.NODE_ENV === Environments.Production;
  }

  get isStaging() {
    return this.NODE_ENV === Environments.Staging;
  }

  get isTesting() {
    return this.NODE_ENV === Environments.Testing;
  }

  get isDevelopment() {
    return this.NODE_ENV === Environments.Development;
  }

  get currentEnv() {
    return this.NODE_ENV;
  }
}
