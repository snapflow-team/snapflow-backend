import { ConfirmationStatus, Prisma, User } from '@generated/prisma';
import { PrismaService } from '../../src/database/prisma.service';

/**
 * Фабрика для создания тестовых сущностей в интеграционных тестах.
 */
export class TestEntityFactory {
  /**
   * Создаёт подтверждённого тестового пользователя с дефолтными значениями.
   *
   * @param prisma Экземпляр PrismaService.
   * @param options Опциональные переопределения полей пользователя.
   * @returns Созданная запись пользователя.
   */
  static async createTestUser(
    prisma: PrismaService,
    options?: {
      suffix?: string;
      username?: string;
      email?: string;
      password?: string;
    },
  ): Promise<User> {
    const suffix = options?.suffix ?? `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const username = options?.username ?? `test_user_${suffix}`;
    const email = options?.email ?? `test_user_${suffix}@example.com`;
    const password = options?.password ?? 'Qwerty_1';

    const data: Prisma.UserCreateInput = {
      username,
      email,
      password,
      emailConfirmationCode: {
        create: {
          confirmationCode: null,
          expirationDate: null,
          confirmationStatus: ConfirmationStatus.Confirmed,
        },
      },
    };

    return prisma.user.create({ data });
  }
}
