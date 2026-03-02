import { IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class ApiSettings {
  @IsNumber()
  port: number;

  @IsString()
  allowedOriginsRaw: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.port = Number(environmentVariables.PORT);

    this.allowedOriginsRaw = environmentVariables.ALLOWED_ORIGINS;
  }

  get allowedOrigins(): string[] | boolean {
    if (this.allowedOriginsRaw === '*' || this.allowedOriginsRaw === 'true') {
      return true;
    }
    return this.allowedOriginsRaw.split(',').map((item) => item.trim());
  }
}
