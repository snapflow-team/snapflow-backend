import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

export class EditPostCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(EditPostCommand)
export class CreatePostUseCase implements ICommandHandler<EditPostCommand> {
  constructor(private readonly commandBus: CommandBus) {}
  async execute(command: EditPostCommand): Promise<void> {}
}
