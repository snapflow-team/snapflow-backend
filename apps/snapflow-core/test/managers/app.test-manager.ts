import { DynamicModule, INestApplication } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { Server } from 'http';
import { PrismaService } from '../../src/database/prisma.service';
import { SnapflowCoreConfig } from '../../src/snapflow-core.config';
import { initSnapFlowCoreAppModule } from '../../src/init-snap-flow-core-app-module';
import { appSetup } from '../../src/setup/app.setup';

export class AppTestManager {
  app: INestApplication;
  prisma: PrismaService;
  snapflowCoreConfig: SnapflowCoreConfig;

  async init(addSettingsToModuleBuilder?: (moduleBuilder: TestingModuleBuilder) => void) {
    const DynamicAppModule: DynamicModule = await initSnapFlowCoreAppModule();

    const testingModuleBuilder: TestingModuleBuilder = Test.createTestingModule({
      imports: [DynamicAppModule],
    });

    if (addSettingsToModuleBuilder) {
      addSettingsToModuleBuilder(testingModuleBuilder);
    }

    const testingAppModule: TestingModule = await testingModuleBuilder.compile();

    this.app = testingAppModule.createNestApplication();

    this.snapflowCoreConfig = this.app.get<SnapflowCoreConfig>(SnapflowCoreConfig);
    this.prisma = this.app.get(PrismaService);

    appSetup(this.app, this.snapflowCoreConfig);

    await this.app.init();
  }

  async cleanupDb(excludedTables: string[] = ['_prisma_migrations']) {
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

  getServer() {
    return this.app.getHttpServer() as Server;
  }
}
