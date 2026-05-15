import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PaginatedViewDto } from '../../../../../../../libs/dto/paginated.view-dto';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { GetPostsQueryParamsDto } from '../../api/input-dto/get-posts.query-params.dto';

export class GetUserPostsQuery {
  constructor(
    public readonly query: GetPostsQueryParamsDto,
    public readonly userId: number,
  ) {}
}

@QueryHandler(GetUserPostsQuery)
export class GetUserPostsQueryHandler implements IQueryHandler<GetUserPostsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ query, userId }: GetUserPostsQuery): Promise<PaginatedViewDto<PostViewDto>> {
    return this.postsQueryRepository.findUserPosts(query, userId);
  }
}
