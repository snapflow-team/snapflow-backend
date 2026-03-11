import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Provider } from '@nestjs/common';
import { resolve } from 'path';
import { PrismaService } from '../../src/database/prisma.service';
import configuration, { validate } from '../../src/setup/configuration/configuration';

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
    process.env.NODE_ENV = 'testing';
    process.env.PRISMA_LOG_QUERIES = process.env.PRISMA_LOG_QUERIES ?? 'false';
    process.env.FILES_SERVICE_HOST = process.env.FILES_SERVICE_HOST ?? '127.0.0.1';
    process.env.FILES_SERVICE_PORT = process.env.FILES_SERVICE_PORT ?? '3002';
    process.env.DATABASE_URL = String(
      process.env.DATABASE_URL ??
        'postgresql://postgres:1234@localhost:5432/dbtest?connection_timeout=10000',
    );
    const appRootPath = resolve(__dirname, '..', '..');
    const customEnvPath = process.env.ENV_FILE_PATH?.trim();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validate,
          envFilePath: [
            customEnvPath ? resolve(process.cwd(), customEnvPath) : '',
            resolve(appRootPath, 'env', '.env.testing.local'),
            resolve(appRootPath, 'env', '.env.testing'),
            resolve(appRootPath, 'env', '.env'),
          ],
        }),
      ],
      providers: [PrismaService, ...providers],
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
