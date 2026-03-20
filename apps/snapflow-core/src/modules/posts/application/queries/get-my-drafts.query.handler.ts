import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';

export class GetMyDraftsQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetMyDraftsQuery)
export class GetMyDraftsHandler implements IQueryHandler<GetMyDraftsQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ userId }: GetMyDraftsQuery): Promise<PostViewDto[]> {
    return await this.postsQueryRepository.findDraftsByUserId(userId);
  }
}
