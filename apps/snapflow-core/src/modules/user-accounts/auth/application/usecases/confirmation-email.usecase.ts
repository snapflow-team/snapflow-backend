import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmationStatus } from '@generated/prisma';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';

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
      throw new DomainException(ErrorCodes.USER_NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);

    if (!user.emailConfirmationCode) {
      throw new DomainException(
        ErrorCodes.CONFIRMATION_CODE,
        'Confirmation data not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const { emailConfirmationCode } = user;

    if (emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed) {
      throw new BadRequestException('Email confirmed');
    }

    if (!emailConfirmationCode.expirationDate) {
      throw new BadRequestException('Confirmation code has no expiration');
    }

    if (this.dateService.isExpired(emailConfirmationCode.expirationDate)) {
      throw new BadRequestException('Email confirmed');
    }

    await this.userRepository.confirmEmail(command.confirmationCode);
  }
}
