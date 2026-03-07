import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { RegistrationUserApplicationDto } from '../../../users/application/dto/registration-user.application-dto';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { ValidationException } from '../../../../../../../../libs/exceptions/validation-exception';
import { ConfirmationStatus, User } from '@generated/prisma';
import { ExpirationTime } from '../../enums/expiration-time.enum';
import { ProfilesRepository } from '../../../users/profile/infrastructure/profiles.repository';
import { PrismaService } from '../../../../../database/prisma.service';

export class RegisterUserCommand {
  constructor(public readonly dto: RegistrationUserApplicationDto) {}
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserUseCase implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly prismaService: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly dateService: DateService,
    private readonly eventBus: EventBus,
  ) {}

  async execute({ dto: { username, email, password } }: RegisterUserCommand): Promise<void> {
    const check = await this.isUsernameOrEmailTaken(username, email);

    if (check.isTaken) {
      throw new ValidationException([
        {
          field: check.field!,
          message:
            check.field === 'username'
              ? 'User with this username is already registered'
              : 'User with this email is already registered',
        },
      ]);
    }

    const passwordHash: string = await this.cryptoService.createPasswordHash(password);
    const confirmationCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = this.dateService.generateExpirationDate({
      hours: ExpirationTime.EmailConfirmationCode,
    });

    await this.prismaService.$transaction(async (tx) => {
      const { id }: User = await this.usersRepository.createUser(
        {
          username,
          email,
          password: passwordHash,

          emailConfirmationCode: {
            create: {
              confirmationStatus: ConfirmationStatus.NotConfirmed,
              confirmationCode,
              expirationDate,
            },
          },
        },
        tx,
      );

      await this.profilesRepository.createProfile(
        {
          userId: id,
          username,
        },
        tx,
      );
    });

    await this.eventBus.publish(new UserRegisteredEvent(email, confirmationCode));
  }

  private async isUsernameOrEmailTaken(
    username: string,
    email: string,
  ): Promise<{ isTaken: boolean; field?: 'username' | 'email' }> {
    const userByUsername: User | null = await this.usersRepository.findUserByUsername(username);
    if (userByUsername) {
      return { isTaken: true, field: 'username' };
    }

    const userByEmail: User | null = await this.usersRepository.findUserByEmail(email);
    if (userByEmail) {
      return { isTaken: true, field: 'email' };
    }

    return { isTaken: false };
  }
}
