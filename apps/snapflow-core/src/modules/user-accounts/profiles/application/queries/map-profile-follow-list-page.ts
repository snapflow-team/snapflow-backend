import { FollowsQueryRepository } from '../../../follows/infrastructure/follows.query-repository';
import { ProfileFollowListRow } from '../../../follows/infrastructure/types/profile-follow-list-row.type';
import { ProfileFollowListPageViewDto } from '../../api/dto/view-dto/profile-follow-list-page.view-dto';
import { ProfileFollowListItemViewDto } from '../../api/dto/view-dto/profile-follow-list-item.view-dto';
import { CursorPaginatedResult } from '../../../../../../../../libs/common/utils/cursor-pagination.util';

export async function mapProfileFollowListPage(
  followsQueryRepository: FollowsQueryRepository,
  paginated: CursorPaginatedResult<ProfileFollowListRow>,
  viewerUserId: number,
): Promise<ProfileFollowListPageViewDto> {
  const followingIds = await followsQueryRepository.getFollowingIdsAmong(
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
