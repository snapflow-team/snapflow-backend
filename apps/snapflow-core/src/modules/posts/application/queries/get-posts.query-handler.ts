import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsPageViewDto } from '../../api/view-dto/posts-page.view-dto';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';

export class GetPostsQuery {
  constructor(
    public readonly pageNumber: number,
    public readonly pageSize: number,
  ) {}
}

@QueryHandler(GetPostsQuery)
export class GetPostsQueryHandler implements IQueryHandler<GetPostsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ pageNumber, pageSize }: GetPostsQuery): Promise<PostsPageViewDto> {
    return this.postsQueryRepository.findPosts({
      pageNumber,
      pageSize,
    });
  }
}
