import { IsBoolean, IsNotEmpty, IsNumber, IsString, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class IngestApiSettings {
  @IsNumber()
  port: number;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  publicHost: string;

  @IsString()
  allowedOriginsRaw: string;

  @IsNotEmpty()
  accessTokenSecret: string;

  @IsBoolean()
  sendInternalServerErrorDetails: boolean;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.STORAGE_INGEST_PORT);
    this.publicHost = environmentVariables.STORAGE_INGEST_PUBLIC_HOST;
    this.allowedOriginsRaw = environmentVariables.STORAGE_INGEST_ALLOWED_ORIGINS;
    this.accessTokenSecret = environmentVariables.JWT_SECRET_AT;
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
