import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DomainException } from '../../../../../../../libs/exceptions/http/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/exceptions/http/domain-exception-codes';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { PostVisibility } from '../../enums/post-visibility.enum';

export class GetPostQuery {
  constructor(
    public readonly postId: number,
    public readonly postVisibility: PostVisibility,
    public readonly userId?: number,
  ) {}
}

@QueryHandler(GetPostQuery)
export class GetPostQueryHandler implements IQueryHandler<GetPostQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ postId, postVisibility, userId }: GetPostQuery): Promise<PostViewDto> {
    if (postVisibility === PostVisibility.Owner && !userId) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Для owner-режима требуется userId',
      });
    }

    const post: PostViewDto | null = await this.postsQueryRepository.getPost({
      postId,
      postVisibility,
      userId,
    });

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Пост не найден',
      });
    }

    return post;
  }
}
