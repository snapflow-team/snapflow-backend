import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseConfig } from './database.config';
import { PrismaClient } from '../../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private readonly dataBaseConfig: DatabaseConfig) {
    const pool = new Pool({ connectionString: dataBaseConfig.url });

    const adapter = new PrismaPg(pool);

    super({ adapter, log: dataBaseConfig.getLogLevels() });

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
