import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';

export class GetMyDraftQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetMyDraftQuery)
export class GetMyDraftHandler implements IQueryHandler<GetMyDraftQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ userId }: GetMyDraftQuery): Promise<PostViewDto> {
    const draft: PostViewDto | null = await this.postsQueryRepository.findDraftByUserId(userId);

    if (!draft) {
      throw new NotFoundException('The draft was not found');
    }

    return draft;
  }
}
