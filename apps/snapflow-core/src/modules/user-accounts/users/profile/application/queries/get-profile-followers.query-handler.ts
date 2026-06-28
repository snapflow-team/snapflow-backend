import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FollowsQueryRepository } from '../../../../../follows/infrastructure/follows.query-repository';
import { ProfileFollowListQueryParamsDto } from '../../api/dto/input-dto/profile-follow-list.query-params.dto';
import { ProfileFollowListPageViewDto } from '../../api/dto/view-dto/profile-follow-list-page.view-dto';
import { ProfileFollowListItemViewDto } from '../../api/dto/view-dto/profile-follow-list-item.view-dto';

export class GetProfileFollowersQuery {
  constructor(
    public readonly profileId: number,
    public readonly query: ProfileFollowListQueryParamsDto,
    public readonly viewerUserId: number,
  ) {}
}

@QueryHandler(GetProfileFollowersQuery)
export class GetProfileFollowersQueryHandler
  implements IQueryHandler<GetProfileFollowersQuery, ProfileFollowListPageViewDto>
{
  constructor(private readonly followsQueryRepository: FollowsQueryRepository) {}

  async execute({
    profileId,
    query,
    viewerUserId,
  }: GetProfileFollowersQuery): Promise<ProfileFollowListPageViewDto> {
    const paginated = await this.followsQueryRepository.findFollowersByProfileId(profileId, query);
    const followingIds = await this.followsQueryRepository.getFollowingIdsAmong(
      viewerUserId,
      paginated.items.map((item) => item.userId),
    );

    return {
      items: paginated.items.map((item) =>
        ProfileFollowListItemViewDto.mapToView(item, followingIds.has(item.userId)),
      ),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };
  }
}
