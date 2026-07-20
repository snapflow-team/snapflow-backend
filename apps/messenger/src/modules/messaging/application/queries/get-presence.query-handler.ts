import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PresenceStatusDto } from '../dto/presence-status.application-dto';
import { isActivityVisible, resolvesShowActivityStatus } from '../helpers/presence-privacy.helper';
import { PresenceRedisRepository } from '../../infrastructure/presence-redis.repository';
import { PresenceRepository } from '../../infrastructure/presence.repository';

export class GetPresenceQuery {
  constructor(
    public readonly requesterUserId: number,
    public readonly userIds: number[],
  ) {}
}

@QueryHandler(GetPresenceQuery)
export class GetPresenceQueryHandler
  implements IQueryHandler<GetPresenceQuery, PresenceStatusDto[]>
{
  constructor(
    private readonly presenceRedisRepository: PresenceRedisRepository,
    private readonly presenceRepository: PresenceRepository,
  ) {}

  async execute({ requesterUserId, userIds }: GetPresenceQuery): Promise<PresenceStatusDto[]> {
    const uniqueUserIds: number[] = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return [];
    }

    const settingsUserIds: number[] = [...new Set([requesterUserId, ...uniqueUserIds])];
    const [settingsMap, onlineMap] = await Promise.all([
      this.presenceRepository.getSettingsMap(settingsUserIds),
      this.presenceRedisRepository.getOnline(uniqueUserIds),
    ]);

    const requesterShows: boolean = resolvesShowActivityStatus(settingsMap.get(requesterUserId));

    return uniqueUserIds.map((userId) => {
      const targetSettings = settingsMap.get(userId);
      const targetShows: boolean = resolvesShowActivityStatus(targetSettings);
      const visible: boolean = isActivityVisible(requesterShows, targetShows);

      if (!visible) {
        return {
          userId: String(userId),
          online: false,
          lastSeenAt: null,
        };
      }

      return {
        userId: String(userId),
        online: onlineMap.get(userId) ?? false,
        lastSeenAt: targetSettings?.lastSeenAt?.toISOString() ?? null,
      };
    });
  }
}
