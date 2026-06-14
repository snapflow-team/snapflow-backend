import { IsEmail, IsNotEmpty, IsNumber, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class AdminSettings {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsNumber()
  sessionMaxAgeHours: number;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  paymentsServiceUrl: string;

  @IsNotEmpty()
  internalApiSecret: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.email = environmentVariables.ADMIN_EMAIL;
    this.password = environmentVariables.ADMIN_PASSWORD;
    this.sessionMaxAgeHours = Number(environmentVariables.ADMIN_SESSION_MAX_AGE_HOURS);
    this.paymentsServiceUrl = environmentVariables.PAYMENTS_SERVICE_URL;
    this.internalApiSecret = environmentVariables.INTERNAL_API_SECRET;
  }
}
