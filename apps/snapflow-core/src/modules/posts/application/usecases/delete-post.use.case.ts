import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import { DomainException, DomainExceptionCode } from '../../../../../../../libs/exceptions/http';

export class DeletePostCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute({ userId, postId }: DeletePostCommand): Promise<void> {
    const isDeleted: boolean = await this.postsRepository.deletePost(postId, userId);

    if (!isDeleted) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Пост не найден',
      });
    }
  }
}
