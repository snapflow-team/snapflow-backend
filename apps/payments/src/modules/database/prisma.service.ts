import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@generated/prisma-payments';
import { Configuration } from '../../setup/configuration/configuration';
import { DatabaseSettings } from '../../setup/configuration/database-settings';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly logger = new Logger(PrismaService.name),
  ) {
    const databaseSettings: DatabaseSettings =
      configService.get<DatabaseSettings>('databaseSettings');

    const pool = new Pool({ connectionString: databaseSettings.url });

    const adapter = new PrismaPg(pool);

    super({ adapter, log: databaseSettings.getLogLevels() });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();

      this.logger.debug('✅ Database connected successfully');
    } catch (error) {
      this.logger.error(`❌ Database connection failed: ${error.message}`, error.stack);
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
