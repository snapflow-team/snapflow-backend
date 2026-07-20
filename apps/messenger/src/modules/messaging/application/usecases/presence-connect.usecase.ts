import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PresenceConnectCommand } from '../commands/presence-connect.command';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { resolvesShowActivityStatus } from '../helpers/presence-privacy.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';
import { UserPresenceSettings } from '@generated/prisma-messenger';

@CommandHandler(PresenceConnectCommand)
export class PresenceConnectUseCase implements ICommandHandler<PresenceConnectCommand, void> {
  constructor(
    private readonly presenceRedisRepository: PresenceRedisRepository,
    private readonly presenceRepository: PresenceRepository,
    private readonly presenceBroadcastHelper: PresenceBroadcastHelper,
  ) {}

  async execute({ dto }: PresenceConnectCommand): Promise<void> {
    const becameOnline: boolean = await this.presenceRedisRepository.addConnection(
      dto.userId,
      dto.socketId,
    );
    if (!becameOnline) {
      return;
    }

    const settings: UserPresenceSettings | null = await this.presenceRepository.getSettings(
      dto.userId,
    );
    if (!resolvesShowActivityStatus(settings)) {
      return;
    }

    await this.presenceBroadcastHelper.emitToPeersWhoShowActivity(dto.userId, {
      online: true,
      lastSeenAt: null,
    });
  }
}
