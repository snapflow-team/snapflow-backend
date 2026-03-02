import { EnvironmentVariable } from './configuration';
import { Prisma } from '@generated/prisma';
import { IsBoolean, IsString } from 'class-validator';

// todo: вынести в либу
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
