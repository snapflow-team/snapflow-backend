import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { ConfirmationStatus, EmailConfirmationCode } from '@generated/prisma';
import { ValidationException } from '../../../../../../../../libs/common/exceptions/validation.exception';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';
import { HttpStatus } from '@nestjs/common';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';

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
      await this.userRepository.findUserWithEmailConfirmationByEmail(command.email);
    if (!user) {
      // TODO Выкинуть 404
      // TODO Или же 204 как чтобы не раскрывать email
      throw new ValidationException([
        { field: 'email', message: 'User with this email not found' },
      ]);
    }

    const emailConfirmationCode: EmailConfirmationCode | null = user.emailConfirmationCode;

    if (!emailConfirmationCode) {
      // TODO Выкинуть 500
      throw new DomainException(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Email confirmation code missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed) {
      // TODO Выкинуть DomainExceptions 409
      // TODO Или же 204 как чтобы не раскрывать email
      throw new ValidationException([
        { field: 'email', message: 'User with this email already confirmed' },
      ]);
    }

    const confirmationCode: string = this.cryptoService.generateUUID();
    //
    const expirationDate: Date = this.dateService.generateExpirationDate({ hours: 1 });
    await this.userRepository.updateEmailConfirmationCode(
      emailConfirmationCode.id,
      expirationDate,
      confirmationCode,
    );
    this.eventBus.publish(new UserRegisteredEvent(command.email, confirmationCode));
  }
}
