import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository, PostWithMedia } from '../../infrastructure/posts-repository';

import { PostStatus } from '@generated/prisma';
import { DomainException, DomainExceptionCode } from '../../../../../../../libs/exceptions/http';

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

    if (post.status !== PostStatus.DRAFT) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Можно опубликовать только черновик',
      });
    }

    if (!post.postMedias.length) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Нельзя опубликовать пост без медиа',
      });
    }

    throw new DomainException({
      code: DomainExceptionCode.InternalServerError,
      message: 'Не удалось опубликовать пост',
    });
  }
}
