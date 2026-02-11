import { PasswordRecoveryCodeApplicationDto } from '../dto/password-recovery-code.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserValidationService } from '../../../users/application/services/user-validation.service';

export class CheckPasswordRecoveryCodeCommand {
  constructor(public readonly dto: PasswordRecoveryCodeApplicationDto) {}
}

@CommandHandler(CheckPasswordRecoveryCodeCommand)
export class CheckPasswordRecoveryCodeUseCase
  implements ICommandHandler<CheckPasswordRecoveryCodeCommand>
{
  constructor(private readonly userValidationService: UserValidationService) {}

  async execute({ dto: { recoveryCode } }: CheckPasswordRecoveryCodeCommand): Promise<void> {
    await this.userValidationService.validatePasswordRecoveryCode(recoveryCode);
  }
}
