import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Comment, Post } from '@generated/prisma-snapflow';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';
import { PostsRepository } from '../../../infrastructure/posts-repository';
import { CommentsRepository } from '../../infrastructure/comments.repository';
import { CommentsQueryRepository } from '../../infrastructure/comments.query-repository';
import { GetPostCommentsQueryParamsDto } from '../../api/input-dto/get-post-comments.query-params.dto';
import { PostCommentsPageViewDto } from '../../api/view-dto/post-comments-page.view-dto';

export class GetCommentRepliesQuery {
  constructor(
    public readonly query: GetPostCommentsQueryParamsDto,
    public readonly postId: number,
    public readonly commentId: number,
  ) {}
}

@QueryHandler(GetCommentRepliesQuery)
export class GetCommentRepliesQueryHandler implements IQueryHandler<GetCommentRepliesQuery> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commentsRepository: CommentsRepository,
    private readonly commentsQueryRepository: CommentsQueryRepository,
  ) {}

  async execute({
    query,
    postId,
    commentId,
  }: GetCommentRepliesQuery): Promise<PostCommentsPageViewDto> {
    const post: Post | null = await this.postsRepository.findById(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment: Comment | null = await this.commentsRepository.findById(commentId);

    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('Comment not found');
    }

    return this.commentsQueryRepository.findCommentReplies(postId, commentId, query);
  }
}
