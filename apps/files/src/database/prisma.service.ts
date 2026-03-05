import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../setup/configuration/configuration';
import { DatabaseSettings } from '../setup/configuration/database-settings';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

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

      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
