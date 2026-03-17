import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';

export class DeletePostCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}
  //todo: почему не удаляем файл?
  async execute({ userId, postId }: DeletePostCommand): Promise<void> {
    const isDeleted: boolean = await this.postsRepository.deletePost(postId, userId);

    if (!isDeleted) {
      throw new NotFoundException('Post not found');
    }
  }
}
