import { Injectable } from '@nestjs/common';
import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { configValidationUtility } from '../../../../libs/common/config/config-validation.utility';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class DatabaseConfig {
  @IsNotEmpty({
    message: 'Set Env variable DATABASE_URL, example: postgresql://user:pass@localhost:5432/db',
  })
  url: string;

  @IsBoolean({
    message: 'Set Env variable PRISMA_LOG_QUERIES to boolean value (true or false)',
  })
  logQueries: boolean;

  constructor(private readonly configService: ConfigService<any, true>) {
    this.url = this.configService.get('DATABASE_URL')!;

    this.logQueries = configValidationUtility.convertToBoolean(
      this.configService.get('PRISMA_LOG_QUERIES'),
    ) as boolean;

    configValidationUtility.validateConfig(this);
  }

  getLogLevels(): Prisma.LogLevel[] {
    return this.logQueries ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'];
  }
}
