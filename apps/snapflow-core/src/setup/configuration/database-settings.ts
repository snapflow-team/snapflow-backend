import { IsBoolean, IsUrl } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class DatabaseSettings {
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url: string;

  @IsBoolean()
  logQueries: boolean;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.url = this.environmentVariables.DATABASE_URL;
    this.logQueries = this.environmentVariables.PRISMA_LOG_QUERIES === 'true';
  }
}
