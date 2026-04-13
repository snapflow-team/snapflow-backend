import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { FilesClient } from '../../../integrations/files/files.client';

export class DeletePostCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly filesClient: FilesClient,
  ) {}
  async execute({ userId, postId }: DeletePostCommand): Promise<void> {
    const post = await this.postsRepository.findByIdAndUser(postId, userId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    await this.postsRepository.deletePost(postId, userId);

    const deletePromises = post.postMedias.map((media) =>
      this.filesClient.deleteFile({
        userId,
        fileUrl: media.url,
      }),
    );
    await Promise.allSettled(deletePromises); // чтобы удалить все даже если 1 упал
    //todo(vitaliy) refactor нужно изменить логику удаления из S3, чтобы не случился рассинхрон
  }
}
