import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { PrismaService } from '../../../../database/prisma.service';
import { OutboxRepository } from '../../outbox/repositories/outbox.repository';
import { OutboxEventType } from '@generated/prisma-snapflow';
import { PostWithMedia } from '../../types/create-media.type';

export class DeletePostCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly postsRepository: PostsRepository,
    private readonly outboxRepository: OutboxRepository,
  ) {}
  async execute({ userId, postId }: DeletePostCommand): Promise<void> {
    const post: PostWithMedia | null = await this.postsRepository.findByIdAndUserId(postId, userId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.prismaService.$transaction(async (tx) => {
      const wasDeleted: boolean = await this.postsRepository.softDeletePostWithMedia(
        postId,
        userId,
        tx,
      );

      if (!wasDeleted) {
        throw new NotFoundException('Post not found');
      }

      for (const media of post.postMedias) {
        await this.outboxRepository.createOutboxEvent(
          OutboxEventType.DELETE_POST_MEDIA_FILE,
          { userId, fileUrl: media.url },
          tx,
        );
      }
    });
  }
}
