import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PresenceHeartbeatCommand } from '../commands/presence-heartbeat.command';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';

@CommandHandler(PresenceHeartbeatCommand)
export class PresenceHeartbeatUseCase implements ICommandHandler<PresenceHeartbeatCommand, void> {
  constructor(private readonly presenceRedisRepository: PresenceRedisRepository) {}

  async execute({ dto }: PresenceHeartbeatCommand): Promise<void> {
    await this.presenceRedisRepository.refresh(dto.userId, dto.socketId);
  }
}
