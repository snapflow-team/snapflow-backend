import { IsNumber, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class MicroserviceSettings {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  constructor(private readonly env: EnvironmentVariable) {
    this.host = this.env.FILES_TCP_HOST;
    this.port = Number(this.env.FILES_TCP_PORT);
  }
}
