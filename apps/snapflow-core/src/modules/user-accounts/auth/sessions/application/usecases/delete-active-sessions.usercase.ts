import { SessionContextDto } from '../../../domain/guards/dto/session-context.dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionsRepository } from '../../infrastructure/sessions.repository';

export class DeleteActiveSessionsCommand {
  constructor(public readonly dto: SessionContextDto) {}
}

@CommandHandler(DeleteActiveSessionsCommand)
export class DeleteActiveSessionsUseCase implements ICommandHandler<DeleteActiveSessionsCommand> {
  constructor(private readonly sessionsRepository: SessionsRepository) {}
  async execute(command: DeleteActiveSessionsCommand): Promise<void> {
    const { userId, deviceId } = command.dto;
    await this.sessionsRepository.softDeleteAllActiveSessions(userId, deviceId);
  }
}
