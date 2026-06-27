import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';
import { CommentLike, Post, Prisma } from '@generated/prisma-snapflow';
import { PostsRepository } from '../../../infrastructure/posts-repository';
import { CommentLikesRepository } from '../../infrastructure/comment-likes.repository';
import { CommentsRepository } from '../../infrastructure/comments.repository';

export class ToggleCommentLikeCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
    public readonly commentId: number,
  ) {}
}

@CommandHandler(ToggleCommentLikeCommand)
export class ToggleCommentLikeUseCase implements ICommandHandler<ToggleCommentLikeCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commentsRepository: CommentsRepository,
    private readonly commentLikesRepository: CommentLikesRepository,
  ) {}

  async execute({ userId, postId, commentId }: ToggleCommentLikeCommand): Promise<void> {
    const post: Post | null = await this.postsRepository.findById(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const commentExists: boolean = await this.commentsRepository.existsActiveByIdAndPostId(
      commentId,
      postId,
    );

    if (!commentExists) {
      throw new NotFoundException('Comment not found');
    }

    const existing: CommentLike | null = await this.commentLikesRepository.findByCommentIdAndUserId(
      commentId,
      userId,
    );

    if (existing?.deletedAt === null) {
      await this.commentLikesRepository.softDelete(existing.id);
      return;
    }

    if (existing) {
      await this.commentLikesRepository.restore(existing.id);
      return;
    }

    try {
      await this.commentLikesRepository.create(commentId, userId);
    } catch (error) {
      if (!this.isCommentLikeUniqueConstraintError(error)) {
        throw error;
      }

      const activeLike: CommentLike | null =
        await this.commentLikesRepository.findActiveByCommentIdAndUserId(commentId, userId);

      if (activeLike) {
        return;
      }

      const softDeletedLike: CommentLike | null =
        await this.commentLikesRepository.findByCommentIdAndUserId(commentId, userId);

      if (softDeletedLike) {
        await this.commentLikesRepository.restore(softDeletedLike.id);
      }
    }
  }

  private isCommentLikeUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const meta = error.meta;
    if (!meta) {
      return false;
    }

    if (meta['modelName'] === 'CommentLike') {
      return true;
    }

    const target = meta['target'];
    if (!target) {
      return false;
    }

    const matchesCommentLikeIndex = (value: string): boolean =>
      value.includes('comment_likes_comment_user_unique_active') ||
      (value.includes('comment_id') && value.includes('user_id'));

    return Array.isArray(target)
      ? target.some(matchesCommentLikeIndex)
      : typeof target === 'string' && matchesCommentLikeIndex(target);
  }
}
