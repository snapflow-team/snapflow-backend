import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { PrismaService } from '../../../../../database/prisma.service';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { UserWithPasswordRecoveryCode } from '../../../users/types/user-with-password-recovery.type';
import { PasswordRecoveryCodeApplicationDto } from '../dto/password-recovery-code.application-dto';
import {
  CheckPasswordRecoveryCodeCommand,
  CheckPasswordRecoveryCodeUseCase,
} from './check-password-recovery-code.usecase';
import { SnapflowCoreModule } from '../../../../../snapflow-core.module';
import { CoreModule } from '../../../../../core/core.module';
import { UserAccountsModule } from '../../../user-accounts.module';

//todo: разобраться как правильно поднять тестовый модуль
describe('CheckPasswordRecoveryCodeUseCase (Integration)', () => {
  let module: TestingModule;
  let commandBus: CommandBus;
  let userValidationService: UserValidationService;
  let dateService: DateService;
  let usersRepository: UsersRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CoreModule, SnapflowCoreModule, UserAccountsModule],
      providers: [],
    }).compile();

    commandBus = module.get<CommandBus>(CommandBus);
    userValidationService = module.get<UserValidationService>(UserValidationService);
    dateService = module.get<DateService>(DateService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    prisma = module.get<PrismaService>(PrismaService);

    const x = module.get<CheckPasswordRecoveryCodeUseCase>(CheckPasswordRecoveryCodeUseCase);
    const handlers = (commandBus as any).handlers;
    console.log([...handlers.keys()]);

    console.log(x);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // очистка тестовой БД (пример для Prisma)
    await prisma.passwordRecoveryCode.deleteMany({});
    await prisma.user.deleteMany({});
  });

  const createUserWithPasswordRecoveryCode = async (userData?: {
    email: string;
    username: string;
    password: string;
  }) => {
    const defaultData = {
      email: 'test-user@example.com',
      username: 'test_user',
      password: 'Qwerty_1',
      ...userData,
    };
    const recoveryCode = 'valid-recovery-code-123';
    const expirationDate: Date = dateService.generateExpirationDate({ hours: 1 });

    return prisma.user.create({
      data: {
        username: defaultData.username,
        email: defaultData.email,
        password: defaultData.password,
        deletedAt: null,
        passwordRecoveryCode: {
          create: {
            recoveryCode,
            expirationDate,
          },
        },
      },
      include: { passwordRecoveryCode: true },
    });
  };

  describe('Позитивные сценарии', () => {
    it('должен успешно валидировать корректный recoveryCode', async () => {
      // +1 час

      const user = await createUserWithPasswordRecoveryCode();

      if (!user.passwordRecoveryCode || !user.passwordRecoveryCode.recoveryCode) {
        throw new Error('Password recovery code not found (Test №1)');
      }

      const { recoveryCode, expirationDate } = user.passwordRecoveryCode;

      const dto: PasswordRecoveryCodeApplicationDto = {
        recoveryCode,
      };
      const command = new CheckPasswordRecoveryCodeCommand(dto);

      const result = await commandBus.execute(command);

      expect(result).toBeUndefined();

      const foundUser: UserWithPasswordRecoveryCode | null =
        await usersRepository.findUserByPasswordRecoveryCode(recoveryCode);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(user.id);
      expect(foundUser!.passwordRecoveryCode!.recoveryCode).toBe(recoveryCode);
      expect(foundUser!.passwordRecoveryCode!.expirationDate).toEqual(expirationDate);
    });

    // it('должен корректно работать с recoveryCode без expirationDate (если допустимо в бизнес‑логике)', async () => {
    //   const recoveryCode = 'no-expiration-code';
    //   const email = 'no-exp-user@example.com';
    //   const password = 'hashed-password';
    //
    //   const user = await prisma.user.create({
    //     data: {
    //       username: 'noexpuser',
    //       email,
    //       password,
    //       deletedAt: null,
    //       passwordRecoveryCode: {
    //         create: {
    //           recoveryCode,
    //           expirationDate: null,
    //         },
    //       },
    //     },
    //     include: { passwordRecoveryCode: true },
    //   });
    //
    //   const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
    //   const command = new CheckPasswordRecoveryCodeCommand(dto);
    //
    //   const result = await commandBus.execute(command);
    //
    //   expect(result).toBeUndefined();
    //
    //   const foundUser: UserWithPasswordRecoveryCode | null =
    //     await usersRepository.findUserByPasswordRecoveryCode(recoveryCode);
    //
    //   expect(foundUser).toBeDefined();
    //   expect(foundUser!.id).toBe(user.id);
    //   expect(foundUser!.passwordRecoveryCode!.recoveryCode).toBe(recoveryCode);
    //   expect(foundUser!.passwordRecoveryCode!.expirationDate).toBeNull();
    // });
    //
    // it('должен корректно обрабатывать recoveryCode с минимально допустимой длиной', async () => {
    //   const recoveryCode = 'a'.repeat(6); // например, минимальная длина 6
    //   const email = 'min-code-user@example.com';
    //   const password = 'hashed-password';
    //   const expirationDate = new Date(Date.now() + 1000 * 60 * 60);
    //
    //   await prisma.user.create({
    //     data: {
    //       username: 'mincodeuser',
    //       email,
    //       password,
    //       deletedAt: null,
    //       passwordRecoveryCode: {
    //         create: {
    //           recoveryCode,
    //           expirationDate,
    //         },
    //       },
    //     },
    //   });
    //
    //   const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
    //   const command = new CheckPasswordRecoveryCodeCommand(dto);
    //
    //   await expect(commandBus.execute(command)).resolves.not.toThrow();
    // });
    //
    // it('должен корректно обрабатывать recoveryCode с максимально допустимой длиной', async () => {
    //   const recoveryCode = 'a'.repeat(100); // например, макс. длина 100
    //   const email = 'max-code-user@example.com';
    //   const password = 'hashed-password';
    //   const expirationDate = new Date(Date.now() + 1000 * 60 * 60);
    //
    //   await prisma.user.create({
    //     data: {
    //       username: 'maxcodeuser',
    //       email,
    //       password,
    //       deletedAt: null,
    //       passwordRecoveryCode: {
    //         create: {
    //           recoveryCode,
    //           expirationDate,
    //         },
    //       },
    //     },
    //   });
    //
    //   const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
    //   const command = new CheckPasswordRecoveryCodeCommand(dto);
    //
    //   await expect(commandBus.execute(command)).resolves.not.toThrow();
    // });
  });

  // describe('Негативные сценарии: код не найден / невалиден', () => {
  //   it('должен выбросить DomainException, если recoveryCode не существует в БД', async () => {
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode: 'non-existent-code' };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode пустой', async () => {
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode: '' };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode состоит из пробелов', async () => {
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode: '   \t\n   ' };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode null', async () => {
  //     const dto: any = { recoveryCode: null };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode undefined', async () => {
  //     const dto: any = { recoveryCode: undefined };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode имеет неверный тип (не строка)', async () => {
  //     const dto: any = { recoveryCode: 12345 };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если у найденного пользователя нет passwordRecoveryCode', async () => {
  //     const email = 'no-recovery-code-user@example.com';
  //     const password = 'hashed-password';
  //
  //     await prisma.user.create({
  //       data: {
  //         username: 'norecoveryuser',
  //         email,
  //         password,
  //         deletedAt: null,
  //       },
  //     });
  //
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode: 'any-code' };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  // });
  //
  // describe('Негативные сценарии: просроченный код', () => {
  //   it('должен выбросить DomainException, если recoveryCode просрочен', async () => {
  //     const recoveryCode = 'expired-recovery-code';
  //     const email = 'expired-user@example.com';
  //     const password = 'hashed-password';
  //     const expirationDate = new Date(Date.now() - 1000 * 60); // -1 минута
  //
  //     await prisma.user.create({
  //       data: {
  //         username: 'expireduser',
  //         email,
  //         password,
  //         deletedAt: null,
  //         passwordRecoveryCode: {
  //           create: {
  //             recoveryCode,
  //             expirationDate,
  //           },
  //         },
  //       },
  //     });
  //
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code has expired');
  //   });
  //
  //   it('должен выбросить DomainException, если expirationDate null, но бизнес‑логика требует дату', async () => {
  //     // если в бизнес‑логике `isExpired(null)` всё равно считается как просроченный
  //     const recoveryCode = 'null-expiry-code';
  //     const email = 'null-exp-user@example.com';
  //     const password = 'hashed-password';
  //
  //     await prisma.user.create({
  //       data: {
  //         username: 'nullexpuser',
  //         email,
  //         password,
  //         deletedAt: null,
  //         passwordRecoveryCode: {
  //           create: {
  //             recoveryCode,
  //             expirationDate: null,
  //           },
  //         },
  //       },
  //     });
  //
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code has expired');
  //   });
  // });
  //
  // describe('Граничные и грязные кейсы', () => {
  //   it('должен выбросить DomainException, если recoveryCode — спецсимволы и пробелы', async () => {
  //     const recoveryCode = '   @#$%^&*()   ';
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode — очень длинная строка (больше допустимого)', async () => {
  //     const recoveryCode = 'a'.repeat(1000); // явно больше допустимого
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  //
  //   it('должен выбросить DomainException, если recoveryCode — строка с Unicode/эмодзи', async () => {
  //     const recoveryCode = '🚀🔑🔑🔑';
  //     const dto: PasswordRecoveryCodeApplicationDto = { recoveryCode };
  //     const command = new CheckPasswordRecoveryCodeCommand(dto);
  //
  //     await expect(commandBus.execute(command)).rejects.toThrow(DomainException);
  //
  //     const error = await commandBus.execute(command).catch((e) => e);
  //     expect(error.code).toBe(DomainExceptionCode.BadRequest);
  //     expect(error.message).toBe('Recovery code incorrect');
  //   });
  // });
});
