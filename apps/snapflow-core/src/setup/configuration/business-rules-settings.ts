import { IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class BusinessRulesSettings {
  @IsString()
  appEmail: string;

  @IsString()
  appPassword: string;

  @IsNumber()
  sessionCleanupRetentionDays: number;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.appEmail = environmentVariables.EMAIL_APP;
    this.appPassword = environmentVariables.EMAIL_APP_PASSWORD;

    this.sessionCleanupRetentionDays = Number.parseInt(
      environmentVariables.SESSION_CLEANUP_RETENTION_DAYS,
    );
  }
}
