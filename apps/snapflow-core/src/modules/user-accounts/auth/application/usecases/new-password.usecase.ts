import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserWithPasswordRecoveryCode } from '../../../users/types/user-with-password-recovery.type';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { SessionsRepository } from '../../sessions/infrastructure/sessions.repository';

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
    private readonly sessionsRepository: SessionsRepository,
    private readonly userValidationService: UserValidationService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute({ newPassword, recoveryCode }: NewPasswordCommand): Promise<void> {
    const { id: userId }: UserWithPasswordRecoveryCode =
      await this.userValidationService.validatePasswordRecoveryCode(recoveryCode);

    const passwordHash: string = await this.cryptoService.createPasswordHash(newPassword);

    await this.usersRepository.updatePasswordAndResetRecoveryCode(userId, passwordHash);
    await this.sessionsRepository.softDeleteAllSessionForUser(userId);
  }
}
