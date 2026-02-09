import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { UserWithEmailConfirmation } from '../../../users/types/user-with-confirmation.type';
import { ConfirmationStatus } from '@generated/prisma';
import { ValidationException } from '../../../../../../../../libs/common/exceptions/validation-exception';

export class ConfirmationEmailCommand {
  constructor(public readonly confirmationCode: string) {}
}

@CommandHandler(ConfirmationEmailCommand)
export class ConfirmationEmailUseCase implements ICommandHandler<ConfirmationEmailCommand> {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly dateService: DateService,
  ) {}

  async execute({ confirmationCode }: ConfirmationEmailCommand) {
    const user: UserWithEmailConfirmation | null =
      await this.userRepository.findUserByConfirmationCode(confirmationCode);

    if (!user) {
      throw new ValidationException([{ field: 'code', message: 'Confirmation code is invalid' }]);
    }

    const { emailConfirmationCode } = user;

    if (!emailConfirmationCode) {
      throw new ValidationException([{ field: 'code', message: 'Confirmation code is invalid' }]);
    }

    if (!emailConfirmationCode.expirationDate) {
      throw new ValidationException([{ field: 'code', message: 'Confirmation code is invalid' }]);
    }

    if (emailConfirmationCode.confirmationStatus === ConfirmationStatus.Confirmed) {
      throw new ValidationException([{ field: 'code', message: 'Email is already confirmed' }]);
    }

    if (this.dateService.isExpired(emailConfirmationCode.expirationDate)) {
      throw new ValidationException([{ field: 'code', message: 'Confirmation code has expired' }]);
    }

    await this.userRepository.confirmEmail(confirmationCode);
  }
}
