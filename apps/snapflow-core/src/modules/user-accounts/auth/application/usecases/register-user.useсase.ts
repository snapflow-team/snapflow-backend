import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { RegistrationUserApplicationDto } from '../../../users/application/dto/registration-user.application-dto';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { ConfirmationStatus } from '@generated/prisma';
import { ValidationException } from '../../../../../../../../libs/common/exceptions/validation-exception';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';

export class RegisterUserCommand {
  constructor(public readonly dto: RegistrationUserApplicationDto) {}
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserUseCase implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly userValidation: UserValidationService,
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
    private readonly dateService: DateService,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto: { username, email, password } }: RegisterUserCommand): Promise<void> {
    const passwordHash = await this.cryptoService.createPasswordHash(password);
    const confirmationCode = this.cryptoService.generateUUID();
    const expirationDate = this.dateService.generateExpirationDate({ hours: 1 });

    const userByEmail: UserWithEmailConfirmation | null =
      await this.usersRepository.findUserByEmailWithEmailConfirmation(email);
    if (userByEmail) {
      if (this.isConfirmed(userByEmail)) {
        throw new ValidationException([
          { field: 'email', message: 'User with this email is already registered' },
        ]);
      }

      if (username !== userByEmail.username) {
        const userByName: UserWithEmailConfirmation | null =
          await this.usersRepository.findUserByNameWithEmailConfirmation(username);
        if (userByName && userByName.id !== userByEmail.id) {
          throw new ValidationException([
            { field: 'username', message: 'User with this username is already registered' },
          ]);
        }
      }

      await this.usersRepository.updateUnconfirmedUser(userByEmail.id, {
        username,
        passwordHash,
        confirmationCode,
        expirationDate,
      });

      this.eventBus.publish(new UserRegisteredEvent(email, confirmationCode));
      return;
    }

    const userNameExists: UserWithEmailConfirmation | null =
      await this.usersRepository.findUserByNameWithEmailConfirmation(username);
    if (userNameExists) {
      throw new ValidationException([
        { field: 'username', message: 'User with this username is already registered' },
      ]);
    }
    await this.usersRepository.createUser({
      username,
      email,
      password: passwordHash,
      createdAt: new Date(),

      emailConfirmationCode: {
        create: {
          confirmationStatus: ConfirmationStatus.NotConfirmed,
          confirmationCode,
          expirationDate,
        },
      },
    });

    this.eventBus.publish(new UserRegisteredEvent(email, confirmationCode));
  }

  private isConfirmed(user: UserWithEmailConfirmation): boolean {
    if (!user.emailConfirmationCode) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'Email confirmation request does not exist',
      });
    }
    return user.emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed;
  }
}
