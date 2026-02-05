import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { HttpStatus } from '@nestjs/common';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';
import { ConfirmationStatus } from '@generated/prisma';

export class ConfirmationEmailCommand {
  constructor(public readonly confirmationCode: string) {}
}

@CommandHandler(ConfirmationEmailCommand)
export class ConfirmationEmailUseCase implements ICommandHandler<ConfirmationEmailCommand> {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly dateService: DateService,
  ) {}

  async execute(command: ConfirmationEmailCommand) {
    const user: UserWithEmailConfirmation | null =
      await this.userRepository.findUserByConfirmationCode(command.confirmationCode);

    if (!user)
      throw new DomainException(
        ErrorCodes.USER_NOT_FOUND,
        'User with this confirmation code was not found',
        HttpStatus.NOT_FOUND,
      );

    if (!user.emailConfirmationCode) {
      throw new DomainException(
        ErrorCodes.EMAIL_NOT_CONFIRMED,
        'Email confirmation data is missing. Please request a new confirmation code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { emailConfirmationCode } = user;

    if (emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed) {
      throw new DomainException(
        ErrorCodes.EMAIL_ALREADY_CONFIRMED,
        'This email address has already been confirmed.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!emailConfirmationCode.expirationDate) {
      throw new DomainException(
        ErrorCodes.INVALID_CONFIRMATION_CODE,
        'Confirmation code is invalid',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (this.dateService.isExpired(emailConfirmationCode.expirationDate)) {
      throw new DomainException(
        ErrorCodes.EXPIRED_CONFIRMATION_CODE,
        'Confirmation code has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userRepository.confirmEmail(command.confirmationCode);
  }
}
