import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../setup/configuration/configuration';
import { DatabaseSettings } from '../setup/configuration/database-settings';
import { PrismaClient } from '@generated/prisma-snapflow';
import { LoggerFactory } from '../modules/logger/logger.factory';
import { ContextLogger } from '../modules/logger/context-logger';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger: ContextLogger;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    const databaseSettings: DatabaseSettings =
      configService.get<DatabaseSettings>('databaseSettings');

    const pool = new Pool({ connectionString: databaseSettings.url });

    const adapter = new PrismaPg(pool);

    super({ adapter, log: databaseSettings.getLogLevels() });

    this.pool = pool;
    this.logger = loggerFactory.create(PrismaService.name);
  }

  async onModuleInit() {
    try {
      await this.$connect();

      this.logger.log('Database connected successfully', this.onModuleInit.name);
    } catch (error) {
      this.logger.error(error, this.onModuleInit.name);

      process.exit(1);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
