import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DomainException } from '../../../../../../../libs/exceptions/http/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/exceptions/http/domain-exception-codes';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';

export enum PostVisibility {
  Owner = 'owner',
  Public = 'public',
}
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

  async execute(query: GetPostQuery): Promise<PostViewDto> {
    if (query.postVisibility === PostVisibility.Owner && !query.userId) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Для owner-режима требуется userId',
      });
    }

    const post: PostViewDto | null = await this.postsQueryRepository.getPost(query);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Пост не найден',
      });
    }

    return post;
  }
}
