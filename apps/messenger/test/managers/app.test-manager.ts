import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { Server } from 'http';
import { applyAppInitialization } from '../../src/setup/app-initialization';
import { PrismaService } from '../../src/modules/database/prisma.service';
import { MessengerModule } from '../../src/messenger.module';
import { Configuration } from '../../src/setup/configuration/configuration';
import { ApiSettings } from '../../src/setup/configuration/api-settings';
import { SocketIoCorsAdapter } from '../../src/setup/socket-io-cors.adapter';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../src/core/providers/provide-tokens/redis-client.inject-token';
import { Redis } from 'ioredis';

export class AppTestManager {
  app: INestApplication;
  prisma: PrismaService;

  async init(addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void) {
    await this.bootstrapApp(addSettingsToModuleBuilder);
    await this.app.init();
  }

  async initWithRedisWebSocketAdapter(
    addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void,
  ) {
    await this.bootstrapApp(addSettingsToModuleBuilder);

    const configService: ConfigService<Configuration, true> = this.app.get(
      ConfigService<Configuration, true>,
    );
    const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');
    const redisClient: Redis = this.app.get(REDIS_CLIENT_INJECT_TOKEN);
    const ioAdapter = new SocketIoCorsAdapter(this.app, apiSettings.allowedOrigins);

    await ioAdapter.connectToRedis(redisClient);
    this.app.useWebSocketAdapter(ioAdapter);

    await this.app.init();
  }

  private async bootstrapApp(
    addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void,
  ) {
    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule({
      imports: [MessengerModule],
    });

    if (addSettingsToModuleBuilder) {
      addSettingsToModuleBuilder(testingModuleBuilder);
    }

    const testingAppModule: TestingModule = await testingModuleBuilder.compile();

    this.app = testingAppModule.createNestApplication();
    this.prisma = this.app.get(PrismaService);

    applyAppInitialization(this.app);
  }

  async cleanupDb(excludedTables: string[]) {
    const tables: { tablename: string }[] = await this.prisma.$queryRawUnsafe(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public';
    `);

    for (const { tablename } of tables) {
      if (excludedTables.includes(tablename)) {
        continue;
      }

      await this.prisma.$executeRawUnsafe(`
        TRUNCATE TABLE "public"."${tablename}"
        RESTART IDENTITY
        CASCADE;
      `);
    }
  }

  async close() {
    await this.prisma.$disconnect();
    await this.app.close();
  }

  getApp(): INestApplication {
    return this.app;
  }

  getServer(): Server {
    return this.app.getHttpServer() as Server;
  }
}
