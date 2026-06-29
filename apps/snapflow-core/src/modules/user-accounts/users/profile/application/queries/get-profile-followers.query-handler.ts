import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FollowsQueryRepository } from '../../../../../follows/infrastructure/follows.query-repository';
import { ProfileFollowListQueryParamsDto } from '../../api/dto/input-dto/profile-follow-list.query-params.dto';
import { ProfileFollowListPageViewDto } from '../../api/dto/view-dto/profile-follow-list-page.view-dto';
import { mapProfileFollowListPage } from './map-profile-follow-list-page';
import { ProfileFollowListRow } from '../../../../../follows/infrastructure/types/profile-follow-list-row.type';
import { CursorPaginatedResult } from '../../../../../../../../../libs/common/utils/cursor-pagination.util';

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
    const paginated: CursorPaginatedResult<ProfileFollowListRow> =
      await this.followsQueryRepository.findFollowersByProfileId(profileId, query);

    return mapProfileFollowListPage(this.followsQueryRepository, paginated, viewerUserId);
  }
}
