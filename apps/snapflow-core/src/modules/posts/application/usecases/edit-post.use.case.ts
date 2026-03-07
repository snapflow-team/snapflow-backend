import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository, PostWithMedia } from '../../infrastructure/posts-repository';
import { UpdatePostInputDto } from '../../api/input-dto/update-post.input.dto';
import { DomainException } from '../../../../../../../libs/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../libs/exceptions/domain-exception-codes';

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
    const isUpdated: boolean = await this.postsRepository.updatePost(postId, userId, dto);

    if (isUpdated) return;

    const post: PostWithMedia | null = await this.postsRepository.findByIdAndUser(postId, userId);
    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Пост не найден',
      });
    }
  }
}
