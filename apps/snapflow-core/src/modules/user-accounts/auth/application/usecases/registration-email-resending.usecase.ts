import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { ConfirmationStatus } from '@generated/prisma';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';
import { ValidationException } from '../../../../../../../../libs/common/exceptions/validation-exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';

export class RegistrationEmailResendingCommand {
  constructor(public readonly email: string) {}
}

@CommandHandler(RegistrationEmailResendingCommand)
export class RegistrationEmailResendingUseCase
  implements ICommandHandler<RegistrationEmailResendingCommand>
{
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly dateService: DateService,
    private readonly cryptoService: CryptoService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegistrationEmailResendingCommand): Promise<void> {
    const user: UserWithEmailConfirmation | null =
      await this.userRepository.findUserByEmailWithEmailConfirmation(command.email);

    if (!user) {
      throw new ValidationException([
        {
          field: 'email',
          message: 'It is impossible to send the code — the specified email is not registered',
        },
      ]);
    }

    const { emailConfirmationCode } = user;

    if (!emailConfirmationCode) {
      // TODO какой статус выкидывать в данном случае?
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'Email confirmation request does not exist',
      });
    }

    if (emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed) {
      throw new ValidationException([
        { field: 'email', message: 'User with this email already confirmed' },
      ]);
    }

    const confirmationCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = this.dateService.generateExpirationDate({ hours: 1 });

    await this.userRepository.updateEmailConfirmationCode(
      emailConfirmationCode.id,
      expirationDate,
      confirmationCode,
    );

    this.eventBus.publish(new UserRegisteredEvent(command.email, confirmationCode));
  }
}
