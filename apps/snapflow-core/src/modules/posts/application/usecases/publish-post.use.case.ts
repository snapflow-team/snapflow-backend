import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository, PostWithMedia } from '../../infrastructure/posts-repository';
import { DomainExceptionCode } from '../../../../../../../libs/exceptions/core/domain-exception-codes';
import { DomainException } from '../../../../../../../libs/exceptions/http/damain.exception';

export class PublishPostCommand {
  constructor(
    public readonly postId: number,
    public readonly userId: number,
  ) {}
}

@CommandHandler(PublishPostCommand)
export class PublishPostUseCase implements ICommandHandler<PublishPostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute({ postId, userId }: PublishPostCommand): Promise<number> {
    const isPublished: boolean = await this.postsRepository.publishDraft(postId, userId);

    if (isPublished) {
      return postId;
    }

    const post: PostWithMedia | null = await this.postsRepository.findByIdAndUser(postId, userId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Пост не найден',
      });
    }

    if (post.status !== 'DRAFT') {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Можно опубликовать только черновик',
      });
    }

    if (!post.postMedias.length) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Нельзя опубликовать пост без фото',
      });
    }

    throw new DomainException({
      code: DomainExceptionCode.InternalServerError,
      message: 'Не удалось опубликовать пост',
    });
  }
}
