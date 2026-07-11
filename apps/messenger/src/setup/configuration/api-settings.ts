import { IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class ApiSettings {
  @IsNumber()
  port: number;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  coreServiceUrl: string;

  @IsString()
  allowedOriginsRaw: string;

  @IsBoolean()
  sendInternalServerErrorDetails: boolean;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.PORT);

    this.coreServiceUrl = environmentVariables.CORE_SERVICE_URL;

    this.allowedOriginsRaw = environmentVariables.ALLOWED_ORIGINS;

    this.sendInternalServerErrorDetails =
      environmentVariables.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';
  }

  get allowedOrigins(): string[] | boolean {
    if (this.allowedOriginsRaw === '*' || this.allowedOriginsRaw === 'true') {
      return true;
    }
    return this.allowedOriginsRaw.split(',').map((item) => item.trim());
  }
}
