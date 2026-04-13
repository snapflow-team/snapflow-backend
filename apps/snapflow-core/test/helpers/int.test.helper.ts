import {
  CreatePostCommand,
  CreatePostUseCase,
} from '../../src/modules/posts/application/usecases/create-post-use.case';
import { PostStatus } from '@generated/prisma-snapflow';
import { ProfilesRepository } from '../../src/modules/user-accounts/users/profile/infrastructure/profiles.repository';
import { PrismaService } from '../../src/database/prisma.service';
import { TestEntityFactory } from './test-entity.factory';
import { Test, TestingModule } from '@nestjs/testing';
import { SnapflowCoreModule } from '../../src/snapflow-core.module';
import { FilesClient } from '../../src/modules/integrations/files/files.client';
import { Type } from '@nestjs/common';

//Тип чтобы переопределять провайдеры при создании тестового модуля
export type OverrideConfig = {
  provide: any;
  useValue: any;
};
export class IntTestHelper {
  private module: TestingModule;
  constructor() {}
  /**
   * Создаёт тестовый модуль NestJS с возможностью переопределения провайдеров.
   *
   * !!! Не использовать в качестве провайдера возвращаемое значение .name - не будет переопределять
   *
   * @param overrides - Список провайдеров для переопределения
   * @returns Скомпилированный TestingModule
   *
   * @example
   * await helper.createTestingModule([
   *   { provide: UsersService, useValue: mockUsersService },
   * ]);
   *
   * @example
   * {provide: UsersService.name, useValue: mockUsersService};
   */
  async createTestingModule(overrides: OverrideConfig[] = []) {
    const moduleBuilder = Test.createTestingModule({
      imports: [SnapflowCoreModule],
    });
    // переопределяем в модуле каждый провайдер, который мы передали внутрь
    overrides.forEach(({ provide, useValue }) => {
      moduleBuilder.overrideProvider(provide).useValue(useValue);
    });
    //Мы запоминаем переопределения, чтобы мы могли
    this.module = await moduleBuilder.compile();
    return this.module;
  }
  async close() {
    await this.module.close();
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
  async cleanupDb(excludedTables: string[] = ['_prisma_migrations']) {
    const prisma = this.get<PrismaService>(PrismaService);

    const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public';
    `);

    for (const { tablename } of tables) {
      if (excludedTables.includes(tablename)) {
        continue;
      }

      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE "public"."${tablename}"
        RESTART IDENTITY
        CASCADE;
      `);
    }
  }
  /**
   * Возвращает провайдер из тестового модуля по классу, токену или символу.
   *
   * @typeParam T - Тип провайдера, который будет возвращён
   * @param typeOrToken - Класс, строковый токен или символ провайдера
   * @returns Экземпляр указанного провайдера
   *
   * @example
   * const userService = helper.get(UsersService);
   *
   */
  get<T>(typeOrToken: string | symbol | Type<T>): T {
    return this.module.get(typeOrToken);
  }

  async createUserWithProfile(prisma: PrismaService, suffix: string) {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix });
    const profileRepo = this.get<ProfilesRepository>(ProfilesRepository);
    const profileId = (
      await profileRepo.createProfile({ userId: user.id, username: user.username })
    ).id;
    await profileRepo.updateProfile({
      profileId,
      username: `user_${suffix}`,
      firstName: `First_${suffix}`,
      lastName: `Last_${suffix}`,
      dateOfBirth: new Date(),
      country: 'Russia',
      city: 'Moscow',
      aboutMe: `About me ${suffix}`,
    });
    return user;
  }

  async createPost(
    userId: number,
    fileIds: string[],
    status: PostStatus = PostStatus.PUBLISHED,
    description: string = 'Some description for post',
  ) {
    const fileClientMocked = this.get(FilesClient);
    fileClientMocked.validateFiles = jest.fn().mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId, index) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1000 + index,
      })),
    });
    const useCase = this.get(CreatePostUseCase);
    return useCase.execute(
      new CreatePostCommand({
        userId,
        status,
        description,
        fileIds,
      }),
    );
  }

  async createSession(prisma: PrismaService, userId: number, deviceId: string) {
    return prisma.session.create({
      data: {
        userId,
        deviceId,
        deviceName: 'Test Device',
        ip: '127.0.0.1',
        iat: new Date(),
        exp: new Date(Date.now() + 1000 * 60 * 60),
      },
    });
  }
}
