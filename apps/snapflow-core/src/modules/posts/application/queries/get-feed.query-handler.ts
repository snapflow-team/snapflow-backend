import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FollowsQueryRepository } from '../../../user-accounts/follows/infrastructure/follows.query-repository';
import { GetFeedQueryParamsDto } from '../../api/input-dto/get-feed.query-params.dto';
import { FeedPageViewDto } from '../../api/view-dto/feed-page.view-dto';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';

export class GetFeedQuery {
  constructor(
    public readonly query: GetFeedQueryParamsDto,
    public readonly viewerId: number,
  ) {}
}

@QueryHandler(GetFeedQuery)
export class GetFeedQueryHandler implements IQueryHandler<GetFeedQuery> {
  constructor(
    private readonly followsQueryRepository: FollowsQueryRepository,
    private readonly postsQueryRepository: PostsQueryRepository,
  ) {}

  async execute({ query, viewerId }: GetFeedQuery): Promise<FeedPageViewDto> {
    const followingIds: number[] = await this.followsQueryRepository.getFollowingUserIds(viewerId);

    if (followingIds.length === 0) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    return this.postsQueryRepository.findFeedPosts(query, followingIds, viewerId);
  }
}
