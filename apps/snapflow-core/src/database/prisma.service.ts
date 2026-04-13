import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../setup/configuration/configuration';
import { DatabaseSettings } from '../setup/configuration/database-settings';
import { PrismaClient } from '@generated/prisma-snapflow';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger: Logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService<Configuration, true>) {
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

      this.logger.log('\x1b[36m✅ Database connected successfully\x1b[0m');
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
