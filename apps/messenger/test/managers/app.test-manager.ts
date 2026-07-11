import { INestApplication } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { Server } from 'http';
import { applyAppInitialization } from '../../src/setup/app-initialization';
import { PrismaService } from '../../src/modules/database/prisma.service';
import { MessengerModule } from '../../src/messenger.module';

export class AppTestManager {
  app: INestApplication;
  prisma: PrismaService;

  async init(addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void) {
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

    await this.app.init();
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
