import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

export class NewPasswordCommand {
  constructor(
    public readonly newPassword: string,
    public readonly recoveryCode: string,
  ) {}
}

@CommandHandler(NewPasswordCommand)
export class NewPasswordUseCase implements ICommandHandler<NewPasswordCommand> {
  async execute(command: NewPasswordCommand): Promise<void> {}
}
