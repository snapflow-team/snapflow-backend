import { PrismaService } from '../../src/database/prisma.service';
import { User } from '../../generated/prisma';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import {
  RegistrationUserInputDto
} from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';

/**
 * 🔐 AuthTestManager
 *
 * Менеджер для e2e-тестирования сценариев аутентификации и регистрации.
 *
 * Используется в e2e-тестах для:
 *  - регистрации пользователей через HTTP
 *  - подготовки тестовых данных
 */
export class AuthTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  /**
   * 📝 Регистрация пользователей через /auth/registration
   *
   * Метод отправляет HTTP-запросы на endpoint регистрации
   * и ожидает успешный результат (204 No Content).
   *
   * Используется:
   *  - для подготовки данных перед тестами
   *  - для массовой регистрации пользователей
   *
   * @param inputDtos - массив DTO для регистрации.
   *                    Если не передан — будет сгенерирован автоматически.
   * @param count - количество DTO для генерации,
   *                используется только если inputDtos пуст.
   *
   * @example
   * await authTestManager.registration();
   *
   * @example
   * await authTestManager.registration([], 3);
   *
   * @example
   * await authTestManager.registration([customDto]);
   */
  async registration(inputDtos: RegistrationUserInputDto[] = [], count: number = 1): Promise<void> {
    const dtos: RegistrationUserInputDto[] =
      inputDtos.length > 0 ? inputDtos : TestDtoFactory.generateRegistrationUserInputDto(count);

    const registrationPromises: Promise<Response>[] = [];

    for (let i = 0; i < dtos.length; i++) {
      registrationPromises.push(
        request(this.server)
          .post(`/${GLOBAL_PREFIX}/auth/registration`)
          .send(dtos[i])
          .expect(HttpStatus.NO_CONTENT),
      );
    }

    await Promise.all(registrationPromises);
  }

  /**
   * 📝 Регистрация пользователей с последующим подтверждением по коду
   *
   * Метод выполняет:
   *  1) массовую регистрацию пользователей через /auth/registration
   *  2) получение из БД сгенерированных кодов подтверждения
   *  3) отправку запросов на /auth/registration-confirmation для подтверждения аккаунтов
   *
   * Используется:
   *  - для подготовки уже подтверждённых пользователей перед тестами
   *  - для сценариев, где нужно иметь активных пользователей
   *
   * @param inputDtos - массив DTO для регистрации.
   *                    Если не передан — будет сгенерирован автоматически.
   * @param count - количество DTO для генерации,
   *                используется только если inputDtos пуст.
   *
   * @returns Promise<UserWithEmailConfirmation[]> - массив пользователей с их кодами подтверждения
   *
   * @example
   * // Регистрация и подтверждение одного пользователя
   * const [user] = await authTestManager.registrationWithConfirmation();
   *
   * @example
   * // Регистрация и подтверждение трёх пользователей
   * const users = await authTestManager.registrationWithConfirmation([], 3);
   *
   * @example
   * // Регистрация и подтверждение пользователей с кастомными DTO
   * const users = await authTestManager.registrationWithConfirmation([customDto]);
   */

  async registrationWithConfirmation(
    inputDtos: RegistrationUserInputDto[] = [],
    count: number = 1,
  ): Promise<UserWithEmailConfirmation[]> {
    const dtos: RegistrationUserInputDto[] =
      inputDtos.length > 0 ? inputDtos : TestDtoFactory.generateRegistrationUserInputDto(count);

    const registrationPromises: Promise<Response>[] = [];

    for (let i = 0; i < dtos.length; i++) {
      registrationPromises.push(
        request(this.server)
          .post(`/${GLOBAL_PREFIX}/auth/registration`)
          .send(dtos[i])
          .expect(HttpStatus.NO_CONTENT),
      );
    }

    await Promise.all(registrationPromises);

    // После регистрации достаём пользователей с confirmationCodes
    const usersWithCodes: UserWithEmailConfirmation[] = await this.prisma.user.findMany({
      where: {
        email: { in: dtos.map((dto) => dto.email) },
      },
      include: {
        emailConfirmationCode: true,
      },
    });

    for (let i = 0; i < dtos.length; i++) {
      const code: string = usersWithCodes[i].emailConfirmationCode!.confirmationCode!;

      registrationPromises.push(
        request(this.server)
          .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
          .send({ code })
          .expect(HttpStatus.NO_CONTENT),
      );
    }

    return usersWithCodes;
  }

  /**
   * 📦 Получить всех пользователей из БД
   *
   * Используется в e2e-тестах для:
   *  - проверки количества пользователей
   *  - проверки корректности сохранённых данных
   *
   * ❗ Работает напрямую с БД, минуя HTTP-слой.
   */
  //todo: временное решение пока не появится роут для выборки списка пользователей!
  async getAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }
}
