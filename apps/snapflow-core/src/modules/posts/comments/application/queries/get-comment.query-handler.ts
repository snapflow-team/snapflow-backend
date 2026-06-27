import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';
import { CommentsQueryRepository } from '../../infrastructure/comments.query-repository';
import { CommentItemViewDto } from '../../api/view-dto/comment-item.view-dto';

export class GetCommentQuery {
  constructor(public readonly commentId: number) {}
}

@QueryHandler(GetCommentQuery)
export class GetCommentQueryHandler implements IQueryHandler<GetCommentQuery> {
  constructor(private readonly commentsQueryRepository: CommentsQueryRepository) {}

  async execute({ commentId }: GetCommentQuery): Promise<CommentItemViewDto> {
    const comment: CommentItemViewDto | null =
      await this.commentsQueryRepository.findById(commentId);

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }
}
