import { EnvironmentVariable } from './configuration';
import { IsNumber, IsString } from 'class-validator';

export class ExternalServicesSettings {
  @IsString()
  filesHost: string;

  @IsNumber()
  filesPort: number;

  constructor(env: EnvironmentVariable) {
    this.filesHost = env.FILES_SERVICE_HOST;
    this.filesPort = Number(env.FILES_SERVICE_PORT);
  }

  getFilesServiceOptions() {
    return {
      host: this.filesHost,
      port: this.filesPort,
    };
  }
}
