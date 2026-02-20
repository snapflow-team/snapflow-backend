import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { RegistrationUserApplicationDto } from '../../../users/application/dto/registration-user.application-dto';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { ConfirmationStatus } from '../../../../../../generated/prisma';

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
    await this.userValidation.validateUniqueUser(username, email);

    const passwordHash: string = await this.cryptoService.createPasswordHash(password);
    const confirmationCode: string = this.cryptoService.generateUUID();
    // todo: вынести в enum { hours: 1 }
    const expirationDate: Date = this.dateService.generateExpirationDate({ hours: 1 });

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
}
