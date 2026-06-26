import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProfilesQueryRepository } from '../../infrastructure/query/profiles.query-repository';
import { PublicProfileViewDto } from '../../api/dto/view-dto/public-profile.view-dto';
import { FollowsQueryRepository } from '../../../../../follows/infrastructure/follows.query-repository';

export class GetPublicProfileQuery {
  constructor(
    public readonly profileId: number,
    public readonly viewerId?: number,
  ) {}
}

@QueryHandler(GetPublicProfileQuery)
export class GetPublicProfileQueryHandler
  implements IQueryHandler<GetPublicProfileQuery, PublicProfileViewDto>
{
  constructor(
    private readonly profilesQueryRepository: ProfilesQueryRepository,
    private readonly followsQueryRepository: FollowsQueryRepository,
  ) {}

  async execute({ profileId, viewerId }: GetPublicProfileQuery): Promise<PublicProfileViewDto> {
    const profile: PublicProfileViewDto =
      await this.profilesQueryRepository.findProfileWithMetadataForUserByIdOrNotFoundFail(
        profileId,
      );

    if (viewerId !== undefined) {
      profile.isFollowing = await this.followsQueryRepository.isFollowing(
        viewerId,
        Number(profile.userId),
      );
    }

    return profile;
  }
}
