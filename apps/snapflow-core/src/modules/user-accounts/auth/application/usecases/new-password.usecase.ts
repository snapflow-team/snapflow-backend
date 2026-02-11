import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserWithPasswordRecoveryCode } from '../../../users/types/user-with-password-recovery.type';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { UserValidationService } from '../../../users/application/services/user-validation.service';

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
    private readonly userValidationService: UserValidationService,
    private readonly cryptoService: CryptoService,
    private readonly dateService: DateService,
  ) {}

  async execute({ newPassword, recoveryCode }: NewPasswordCommand): Promise<void> {
    const user: UserWithPasswordRecoveryCode =
      await this.userValidationService.validatePasswordRecoveryCode(recoveryCode);

    const passwordHash: string = await this.cryptoService.createPasswordHash(newPassword);

    await this.usersRepository.updatePasswordAndResetRecoveryCode(user.id, passwordHash);
  }
}
