import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FollowsQueryRepository } from '../../../../../follows/infrastructure/follows.query-repository';
import { ProfileFollowListQueryParamsDto } from '../../api/dto/input-dto/profile-follow-list.query-params.dto';
import { ProfileFollowListPageViewDto } from '../../api/dto/view-dto/profile-follow-list-page.view-dto';
import { ProfileFollowListItemViewDto } from '../../api/dto/view-dto/profile-follow-list-item.view-dto';

export class GetProfileFollowingQuery {
  constructor(
    public readonly profileId: number,
    public readonly query: ProfileFollowListQueryParamsDto,
    public readonly viewerUserId: number,
  ) {}
}

@QueryHandler(GetProfileFollowingQuery)
export class GetProfileFollowingQueryHandler
  implements IQueryHandler<GetProfileFollowingQuery, ProfileFollowListPageViewDto>
{
  constructor(private readonly followsQueryRepository: FollowsQueryRepository) {}

  async execute({
    profileId,
    query,
    viewerUserId,
  }: GetProfileFollowingQuery): Promise<ProfileFollowListPageViewDto> {
    const paginated = await this.followsQueryRepository.findFollowingByProfileId(profileId, query);
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
