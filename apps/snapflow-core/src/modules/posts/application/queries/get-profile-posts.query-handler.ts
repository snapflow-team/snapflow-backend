import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PaginatedViewDto } from '../../../../../../../libs/dto/paginated.view-dto';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { GetProfilePostsQueryParamsDto } from '../../api/input-dto/get-profile-posts-query-params.dto';

export class GetProfilePostsQuery {
  constructor(
    public readonly query: GetProfilePostsQueryParamsDto,
    public readonly userId: number,
  ) {}
}

@QueryHandler(GetProfilePostsQuery)
export class GetProfilePostsQueryHandler implements IQueryHandler<GetProfilePostsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ query, userId }: GetProfilePostsQuery): Promise<PaginatedViewDto<PostViewDto>> {
    return this.postsQueryRepository.findProfilePosts(query, userId);
  }
}
