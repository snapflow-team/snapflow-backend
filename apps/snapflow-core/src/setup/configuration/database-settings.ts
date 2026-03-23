import { IsBoolean, IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';
import { Prisma } from '@generated/prisma-snapflow';

export class DatabaseSettings {
  @IsString()
  url: string;

  @IsBoolean()
  logQueries: boolean;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.url = this.environmentVariables.DATABASE_URL;
    this.logQueries = this.environmentVariables.PRISMA_LOG_QUERIES === 'true';
  }

  getLogLevels(): Prisma.LogLevel[] {
    return this.logQueries ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'];
  }
}
