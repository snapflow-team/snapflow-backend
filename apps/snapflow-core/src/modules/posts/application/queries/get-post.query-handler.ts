import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostStatus } from '@generated/prisma';
import { DomainException } from '../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';

export class GetPostQuery {
  constructor(
    public readonly postId: number,
    public readonly userId: number,
    public readonly statuses: PostStatus[],
  ) {}
}

@QueryHandler(GetPostQuery)
export class GetPostQueryHandler implements IQueryHandler<GetPostQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ postId, userId, statuses }: GetPostQuery): Promise<PostViewDto> {
    const post: PostViewDto | null = await this.postsQueryRepository.getPostById(
      postId,
      userId,
      statuses,
    );

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Пост не найден',
      });
    }

    return post;
  }
}
