import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class AdminSettings {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsNumber()
  sessionMaxAgeHours: number;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.email = environmentVariables.ADMIN_EMAIL;
    this.password = environmentVariables.ADMIN_PASSWORD;
    this.sessionMaxAgeHours = Number(environmentVariables.ADMIN_SESSION_MAX_AGE_HOURS);
  }
}
