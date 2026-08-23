import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateActivityStatusCommand } from '../commands/update-activity-status.command';
import { PresenceBroadcastHelper } from '../helpers/presence-broadcast.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';

@CommandHandler(UpdateActivityStatusCommand)
export class UpdateActivityStatusUseCase
  implements ICommandHandler<UpdateActivityStatusCommand, void>
{
  constructor(
    private readonly presenceRepository: PresenceRepository,
    private readonly presenceRedisRepository: PresenceRedisRepository,
    private readonly presenceBroadcastHelper: PresenceBroadcastHelper,
  ) {}

  async execute({ dto }: UpdateActivityStatusCommand): Promise<void> {
    await this.presenceRepository.upsertSettings(dto.userId, dto.showActivityStatus);

    if (!dto.showActivityStatus) {
      await this.presenceBroadcastHelper.emitToPeersWhoShowActivity(dto.userId, {
        online: false,
        lastSeenAt: null,
      });
      return;
    }

    const [onlineMap, settings] = await Promise.all([
      this.presenceRedisRepository.getOnline([dto.userId]),
      this.presenceRepository.getSettings(dto.userId),
    ]);

    const online: boolean = onlineMap.get(dto.userId) ?? false;

    await this.presenceBroadcastHelper.emitToPeersWhoShowActivity(dto.userId, {
      online,
      lastSeenAt: online ? null : (settings?.lastSeenAt?.toISOString() ?? null),
    });
  }
}
