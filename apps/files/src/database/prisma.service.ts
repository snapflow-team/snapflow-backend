import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';
import { DatabaseConfig } from './database.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly databaseConfig: DatabaseConfig) {
    const pool = new Pool({ connectionString: databaseConfig.url });
    const adapter = new PrismaPg(pool);

    super({ adapter, log: databaseConfig.getLogLevels() });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('Files database connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Files database connection failed:', message);
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
