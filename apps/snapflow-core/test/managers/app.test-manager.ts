import { DynamicModule, INestApplication } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { Server } from 'http';
import { PrismaService } from '../../src/database/prisma.service';
import { initSnapFlowCoreAppModule } from '../../src/init-snap-flow-core-app-module';
import { ThrottlerStorage } from '@nestjs/throttler';
import { applyAppInitialization } from '../../src/setup/app-initialization';

/**
 * 🧪 AppTestManager
 *
 * Базовый менеджер для e2e-тестов приложения Snapflow Core.
 *
 * Отвечает за:
 *  - поднятие NestJS-приложения в тестовой среде
 *  - инициализацию всех модулей и провайдеров
 *  - доступ к PrismaService
 *  - глобальную настройку приложения
 *  - очистку базы данных между тестами
 *  - корректное завершение приложения
 */
export class AppTestManager {
  app: INestApplication;
  prisma: PrismaService;

  /**
   * 🚀 Инициализация тестового приложения
   *
   * Поднимает полноценное NestJS-приложение
   * с использованием реальных модулей и провайдеров.
   *
   * Последовательность:
   *  1. Динамически создаётся AppModule
   *  2. Создаётся TestingModule
   *  3. Применяются дополнительные настройки (если переданы)
   *  4. Создаётся Nest-приложение
   *  5. Применяется глобальная настройка (pipes, filters, prefix)
   *  6. Инициализируется приложение
   *
   * @param addSettingsToModuleBuilder
   * Функция-хук для изменения TestingModuleBuilder
   * (например, подмена провайдеров, мок сервисов и т.п.)
   *
   * @example
   * await appTestManager.init();
   *
   * @example
   * await appTestManager.init((builder) => {
   *   builder.overrideProvider(EmailService).useValue(mock);
   * });
   */
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

    this.prisma = this.app.get(PrismaService);

    applyAppInitialization(this.app);

    await this.app.init();
  }

  /**
   * 🧹 Очистка базы данных между тестами
   *
   * Удаляет данные из всех таблиц схемы `public`,
   * кроме исключённых.
   *
   * Используется в `beforeEach` для обеспечения
   * полной изоляции тестов.
   *
   * @param excludedTables
   * Список таблиц, которые нельзя очищать
   * (по умолчанию — таблица миграций).
   *
   * @example
   * await appTestManager.cleanupDb();
   *
   * @example
   * await appTestManager.cleanupDb(['migrations']);
   */
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

  /**
   * 🚦 Очистить in-memory хранилище throttler
   *
   * Используется в e2e-тестах для:
   *  - сброса лимитов rate limiting между тестами
   *  - предотвращения ложных 429 Too Many Requests
   *  - обеспечения изоляции тестовых сценариев
   *
   * Метод:
   *  - получает ThrottlerStorage из Nest-контейнера
   *  - приводит его к in-memory реализации
   *  - очищает внутренний Map со счётчиками запросов
   *
   * ❗ Работает только с in-memory storage (Map).
   * Если используется внешнее хранилище (Redis и т.п.),
   * очистка выполняться не будет.
   */
  clearThrottlerStorage() {
    const throttlerStorage: ThrottlerStorage = this.app.get<ThrottlerStorage>(ThrottlerStorage);

    const memoryStorage = throttlerStorage as MemoryThrottlerStorageLike;

    if (memoryStorage.storage instanceof Map) {
      memoryStorage.storage.clear();
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

export interface MemoryThrottlerStorageLike extends ThrottlerStorage {
  storage: Map<string, unknown>;
}
