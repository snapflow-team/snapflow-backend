import { EnvironmentVariable } from './configuration';

export class ExternalServicesSettings {
  filesHost: string;
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
