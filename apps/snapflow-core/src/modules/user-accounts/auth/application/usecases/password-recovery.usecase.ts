import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { DateService } from '../../../../../../../../libs/common/services/date.service';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { ErrorCodes } from '../../../../../../../../libs/common/exceptions/error-codes.enum';
import { HttpStatus } from '@nestjs/common';
import { UserPasswordRecoveryEvent } from '../../domain/events/user-password-recovery.event';
import { PasswordRecoveryCode } from '@generated/prisma';
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
      await this.userRepository.findByEmailWithPasswordRecoveryCode(command.email);

    // TODO Выкидываем 204 Даже если адрес не зарегистрирован
    if (!user) {
      return;
    }

    const passwordRecoveryCode: PasswordRecoveryCode | null = user.passwordRecoveryCode;

    if (!passwordRecoveryCode) {
      throw new DomainException(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const confirmationCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = this.dateService.generateExpirationDate({ hours: 1 });

    await this.userRepository.updatePasswordRecovery(
      passwordRecoveryCode.id,
      expirationDate,
      confirmationCode,
    );

    this.eventBus.publish(new UserPasswordRecoveryEvent(command.email, confirmationCode));
  }
}
