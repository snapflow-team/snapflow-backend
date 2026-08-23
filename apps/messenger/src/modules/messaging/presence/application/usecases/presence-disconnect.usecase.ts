import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PresenceDisconnectCommand } from '../commands/presence-disconnect.command';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { resolvesShowActivityStatus } from '../helpers/presence-privacy.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { UserPresenceSettings } from '@generated/prisma-messenger';

@CommandHandler(PresenceDisconnectCommand)
export class PresenceDisconnectUseCase implements ICommandHandler<PresenceDisconnectCommand, void> {
  constructor(
    private readonly presenceRedisRepository: PresenceRedisRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly presenceBroadcastHelper: PresenceBroadcastHelper,
  ) {}

  async execute({ dto }: PresenceDisconnectCommand): Promise<void> {
    const remainingSockets: number = await this.presenceRedisRepository.removeConnection(
      dto.userId,
      dto.socketId,
    );
    if (remainingSockets > 0) {
      return;
    }

    const settings: UserPresenceSettings | null = await this.presenceRepository.getSettings(
      dto.userId,
    );
    const lastSeenAt = new Date();
    await this.presenceRepository.updateLastSeen(dto.userId, lastSeenAt);

    if (!resolvesShowActivityStatus(settings)) {
      return;
    }

    await this.presenceBroadcastHelper.emitToPeersWhoShowActivity(dto.userId, {
      online: false,
      lastSeenAt: lastSeenAt.toISOString(),
    });
  }
}
