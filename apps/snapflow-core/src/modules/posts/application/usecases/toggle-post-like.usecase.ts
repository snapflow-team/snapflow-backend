import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { Post, PostLike, Prisma } from '@generated/prisma-snapflow';
import { PostLikesRepository } from '../../infrastructure/post-likes.repository';
import { PostsRepository } from '../../infrastructure/posts-repository';

export class TogglePostLikeCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(TogglePostLikeCommand)
export class TogglePostLikeUseCase implements ICommandHandler<TogglePostLikeCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly postLikesRepository: PostLikesRepository,
  ) {}

  async execute({ userId, postId }: TogglePostLikeCommand): Promise<void> {
    const post: Post | null = await this.postsRepository.findById(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing: PostLike | null = await this.postLikesRepository.findByPostIdAndUserId(
      postId,
      userId,
    );

    if (existing?.deletedAt === null) {
      await this.postLikesRepository.softDelete(existing.id);
      return;
    }

    if (existing) {
      await this.postLikesRepository.restore(existing.id);
      return;
    }

    try {
      await this.postLikesRepository.create(postId, userId);
    } catch (error) {
      if (!this.isPostLikeUniqueConstraintError(error)) {
        throw error;
      }

      const activeLike: PostLike | null =
        await this.postLikesRepository.findActiveByPostIdAndUserId(postId, userId);

      if (activeLike) {
        return;
      }

      const softDeletedLike: PostLike | null = await this.postLikesRepository.findByPostIdAndUserId(
        postId,
        userId,
      );

      if (softDeletedLike) {
        await this.postLikesRepository.restore(softDeletedLike.id);
      }
    }
  }

  private isPostLikeUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const meta = error.meta;
    if (!meta) {
      return false;
    }

    if (meta['modelName'] === 'PostLike') {
      return true;
    }

    const target = meta['target'];
    if (!target) {
      return false;
    }

    const matchesPostLikeIndex = (value: string): boolean =>
      value.includes('post_likes_post_user_unique_active') ||
      (value.includes('post_id') && value.includes('user_id'));

    return Array.isArray(target)
      ? target.some(matchesPostLikeIndex)
      : typeof target === 'string' && matchesPostLikeIndex(target);
  }
}
