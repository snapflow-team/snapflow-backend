import { PrismaService } from '../../src/database/prisma.service';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { RegistrationUserInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { User } from '@generated/prisma-snapflow';
import { PasswordRecoveryInputDto } from '../../src/modules/user-accounts/auth/api/input-dto/password-recovery.input-dto';

// vilyamz: вынести в либу этот менеджер
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
    const confirmationPromises: Promise<Response>[] = [];

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

      confirmationPromises.push(
        request(this.server)
          .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
          .send({ code })
          .expect(HttpStatus.NO_CONTENT),
      );
    }

    await Promise.all(confirmationPromises);

    return usersWithCodes;
  }

  /**
   * 🔑 Выполняет полный e2e-флоу авторизации пользователя и возвращает токены
   *
   * Метод последовательно выполняет следующие действия:
   *  1. Регистрирует нового пользователя через `registrationWithConfirmation()`
   *     - выполняется массовая регистрация (по умолчанию 1 пользователь)
   *     - автоматически подтверждается email через код подтверждения
   *  2. Логинится с помощью HTTP-запроса на `/auth/login` с email и паролем зарегистрированного пользователя
   *  3. Извлекает `accessToken` из тела ответа (`res.body.accessToken`) — для использования в `Authorization` header
   *  4. Извлекает `refreshToken` из Set-Cookie (`res.headers['set-cookie']`) — для refresh / logout сценариев
   *  5. Возвращает HTTP-ответ и все полученные данные
   *
   * Используется в e2e-тестах для:
   *  - тестирования защищённых эндпоинтов с действительным access token
   *  - проверки refresh и logout сценариев
   *  - подготовки авторизованной сессии для последующих запросов
   *
   * @returns Promise<{
   *   res: Response;                       // полный HTTP-ответ на POST /auth/login
   *   refreshToken: string;                // refreshToken для использования в cookie
   *   accessToken: string;                 // accessToken для Authorization header
   *   createdUser: UserWithEmailConfirmation; // объект зарегистрированного и подтверждённого пользователя с emailConfirmationCode
   * }>
   *
   * @throws {Error} если:
   *   - accessToken не найден в теле ответа
   *   - refreshToken не найден в Set-Cookie
   *
   * @example
   * const { res, accessToken, refreshToken, createdUser } =
   *   await authTestManager.loginAndGetAuthTokens();
   *
   */
  async loginAndGetAuthTokens(): Promise<{
    res: Response;
    refreshToken: string;
    accessToken: string;
    createdUser: UserWithEmailConfirmation;
  }> {
    const [user]: UserWithEmailConfirmation[] = await this.registrationWithConfirmation();

    const resLogin: Response = await request(this.server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        email: user.email,
        password: 'Qwerty_1',
      })
      .expect(HttpStatus.OK);

    // 🔹 accessToken берём из body
    const body = resLogin.body as unknown as {
      accessToken: string;
    };

    const accessToken: string = body.accessToken;

    if (!accessToken) {
      throw new Error(
        `AuthTestManager.loginAndGetRefreshCookie(): ` +
          `accessToken not found in response body. ` +
          `Body: ${JSON.stringify(resLogin.body)}`,
      );
    }

    // 🔹 refreshToken берём из cookie
    const cookie: string | undefined = resLogin.headers['set-cookie']?.[0];
    const refreshTokenMatch = cookie?.match(/refreshToken=([^;]+)/);

    if (!refreshTokenMatch || !refreshTokenMatch[1]) {
      throw new Error(
        `AuthTestManager.loginAndGetRefreshCookie(): ` +
          `refreshToken not found in Set-Cookie header. ` +
          `Cookie value: "${cookie}".`,
      );
    }

    const refreshToken: string = refreshTokenMatch[1];

    return { res: resLogin, refreshToken, accessToken, createdUser: user };
  }

  /**
   * 🔥 Создаёт просроченный recoveryCode напрямую в БД
   *
   * Используется в e2e-тестах для проверки сценариев,
   * когда код восстановления уже истёк.
   *
   * Метод:
   *  1. Находит пользователя по email
   *  2. Генерирует UUID для recoveryCode
   *  3. Устанавливает expirationDate в прошлом
   *  4. Сохраняет данные в БД
   *
   * ❗ Работает напрямую с Prisma, минуя HTTP-слой.
   *
   * @param email - email пользователя
   * @returns string - созданный просроченный recoveryCode
   */
  async createExpiredRecoveryCode(email: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new Error(
        `AuthTestManager.createExpiredRecoveryCode(): User with email "${email}" not found`,
      );
    }

    const expiredRecoveryCode = crypto.randomUUID();

    // дата в прошлом (например, 1 час назад)
    const expirationDate = new Date(Date.now() - 1000 * 60 * 60);

    await this.prisma.passwordRecoveryCode.upsert({
      where: { userId: user.id },
      update: {
        recoveryCode: expiredRecoveryCode,
        expirationDate,
      },
      create: {
        userId: user.id,
        recoveryCode: expiredRecoveryCode,
        expirationDate,
      },
    });

    return expiredRecoveryCode;
  }

  async passwordRecovery(dto: PasswordRecoveryInputDto): Promise<void> {
    await request(this.server)
      .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);
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
  async getAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async findUserWithEmailConfirmationByEmail(
    email: string,
  ): Promise<UserWithEmailConfirmation | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        email,
      },
      include: { emailConfirmationCode: true },
    });
  }
}
