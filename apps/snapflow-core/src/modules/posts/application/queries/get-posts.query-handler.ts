import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PaginatedViewDto } from '../../../../../../../libs/dto/paginated.view-dto';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { GetPostsQueryParamsDto } from '../../api/input-dto/get-posts.query-params.dto';

export class GetPostsQuery {
  constructor(public readonly query: GetPostsQueryParamsDto) {}
}

@QueryHandler(GetPostsQuery)
export class GetPostsQueryHandler implements IQueryHandler<GetPostsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ query }: GetPostsQuery): Promise<PaginatedViewDto<PostViewDto>> {
    return this.postsQueryRepository.findPosts(query);
  }
}
