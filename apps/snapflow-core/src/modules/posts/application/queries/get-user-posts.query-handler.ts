import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { GetUserPostsQueryParamsDto } from '../../api/input-dto/get-user-posts.query-params.dto';
import { UserPostsPageViewDto } from '../../api/view-dto/user-posts-page.view-dto';

export class GetUserPostsQuery {
  constructor(
    public readonly query: GetUserPostsQueryParamsDto,
    public readonly userId: number,
    public readonly viewerId?: number,
  ) {}
}

@QueryHandler(GetUserPostsQuery)
export class GetUserPostsQueryHandler implements IQueryHandler<GetUserPostsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ query, userId, viewerId }: GetUserPostsQuery): Promise<UserPostsPageViewDto> {
    return this.postsQueryRepository.findUserPosts(query, userId, viewerId);
  }
}
