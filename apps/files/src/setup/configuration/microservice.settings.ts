import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class MicroserviceSettings {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsBoolean()
  sendInternalServerErrorDetails: boolean;

  constructor(private readonly env: EnvironmentVariable) {
    this.host = this.env.FILES_TCP_HOST;
    this.port = Number(this.env.FILES_TCP_PORT);

    this.sendInternalServerErrorDetails = env.SEND_INTERNAL_SERVER_ERROR_DETAILS === 'true';
  }
}
