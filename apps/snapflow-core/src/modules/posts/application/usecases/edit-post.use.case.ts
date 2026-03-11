import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository, PostWithMedia } from '../../infrastructure/posts-repository';
import { UpdatePostInputDto } from '../../api/input-dto/update-post.input.dto';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';

export class EditPostCommand {
  constructor(
    public readonly userId: number,
    public readonly postId: number,
    public readonly dto: UpdatePostInputDto,
  ) {}
}

@CommandHandler(EditPostCommand)
export class EditPostUseCase implements ICommandHandler<EditPostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}
  async execute({ userId, postId, dto }: EditPostCommand): Promise<void> {
    const post: PostWithMedia | null = await this.postsRepository.findByIdAndUser(postId, userId);

    if (!post) {
      throw new NotFoundException('The post was not found');
    }

    const isUpdated: boolean = await this.postsRepository.updatePost(postId, userId, dto);

    if (!isUpdated) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'Не удалось обновить пост',
      });
    }
  }
}
