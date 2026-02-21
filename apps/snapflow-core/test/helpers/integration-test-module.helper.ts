import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Provider } from '@nestjs/common';
import { join } from 'path';
import { DatabaseConfig } from '../../src/database/database.config';
import { PrismaService } from '../../src/database/prisma.service';

/**
 * Хелпер для инициализации и очистки окружения интеграционных тестов.
 */
export class IntegrationTestModuleHelper {
  /**
   * Создаёт и инициализирует тестовый Nest-модуль
   * с общими провайдерами БД и конфигурации.
   *
   * @param providers Дополнительные провайдеры для конкретного интеграционного теста.
   * @returns Инициализированный `TestingModule`.
   */
  static async createTestingModule(providers: Provider[]): Promise<TestingModule> {
    process.env.NODE_ENV = process.env.NODE_ENV ?? 'testing';
    process.env.PRISMA_LOG_QUERIES = process.env.PRISMA_LOG_QUERIES ?? 'false';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            process.env.ENV_FILE_PATH?.trim() || '',
            join(process.cwd(), 'env', '.env.testing.local'),
            join(process.cwd(), 'env', '.env.testing'),
            join(process.cwd(), 'env', '.env.production'),
          ],
        }),
      ],
      providers: [DatabaseConfig, PrismaService, ...providers],
    }).compile();

    await module.init();
    return module;
  }

  /**
   * Очищает таблицы, связанные с auth/sessions тестами.
   *
   * @param prisma Экземпляр PrismaService.
   */
  static async clearAuthSessionsData(prisma: PrismaService): Promise<void> {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
  }

  /**
   * Безопасно закрывает подключение Prisma и тестовый модуль Nest.
   *
   * @param module Опциональный тестовый модуль.
   * @param prisma Опциональный экземпляр PrismaService.
   */
  static async close(module?: TestingModule, prisma?: PrismaService): Promise<void> {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (module) {
      await module.close();
    }
  }
}
