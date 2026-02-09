import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { UserPasswordRecoveryEvent } from '../../domain/events/user-password-recovery.event';
import { UserWithPasswordRecoveryCode } from '../../../users/types/user-with-password-recovery.type';

export class PasswordRecoveryCommand {
  constructor(public readonly email: string) {}
}

@CommandHandler(PasswordRecoveryCommand)
export class PasswordRecoveryUseCase implements ICommandHandler<PasswordRecoveryCommand> {
  constructor(
    private readonly userRepository: UsersRepository,
    private readonly dateService: DateService,
    private readonly cryptoService: CryptoService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: PasswordRecoveryCommand): Promise<void> {
    const user: UserWithPasswordRecoveryCode | null =
      await this.userRepository.findUserByEmailWithPasswordRecoveryCode(command.email);

    if (!user) {
      return;
    }

    const recoveryCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = this.dateService.generateExpirationDate({ hours: 1 });

    await this.userRepository.upsertPasswordRecoveryCode(user.id, recoveryCode, expirationDate);

    this.eventBus.publish(new UserPasswordRecoveryEvent(command.email, recoveryCode));
  }
}
