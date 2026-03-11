import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsPageViewDto } from '../../api/view-dto/posts-page.view-dto';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';

export class GetProfilePostsQuery {
  constructor(
    public readonly userId: number,
    public readonly pageNumber: number,
    public readonly pageSize: number,
  ) {}
}

@QueryHandler(GetProfilePostsQuery)
export class GetProfilePostsQueryHandler implements IQueryHandler<GetProfilePostsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({
    userId,
    pageNumber,
    pageSize,
  }: GetProfilePostsQuery): Promise<PostsPageViewDto> {
    return this.postsQueryRepository.findProfilePublicPosts({
      userId,
      pageNumber,
      pageSize,
    });
  }
}
