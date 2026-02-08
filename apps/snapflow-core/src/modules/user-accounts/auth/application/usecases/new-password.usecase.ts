import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserWithPasswordRecoveryCode } from '../../../users/types/user-with-password-recovery.type';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';
import { HttpStatus } from '@nestjs/common';
import { DateService } from '../../../../../../../../libs/common/services/date.service';

export class NewPasswordCommand {
  constructor(
    public readonly newPassword: string,
    public readonly recoveryCode: string,
  ) {}
}

@CommandHandler(NewPasswordCommand)
export class NewPasswordUseCase implements ICommandHandler<NewPasswordCommand> {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
    private readonly dateService: DateService,
  ) {}

  async execute({ newPassword, recoveryCode }: NewPasswordCommand): Promise<void> {
    const user: UserWithPasswordRecoveryCode | null =
      await this.usersRepository.findUserByPasswordRecoveryCode(recoveryCode);

    if (!user || !user.passwordRecoveryCode) {
      throw new DomainException(
        ErrorCodes.BAD_REQUEST,
        'Recovery code is invalid or expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      user.passwordRecoveryCode.expirationDate &&
      this.dateService.isExpired(user.passwordRecoveryCode.expirationDate)
    ) {
      throw new DomainException(
        ErrorCodes.BAD_REQUEST,
        'Recovery code has expired',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash: string = await this.cryptoService.createPasswordHash(newPassword);

    await this.usersRepository.updatePasswordAndResetRecoveryCode(user.id, passwordHash);
  }
}
