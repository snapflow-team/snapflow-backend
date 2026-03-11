import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository, PostWithMedia } from '../../infrastructure/posts-repository';

import { PostStatus } from '@generated/prisma';
import { DomainException, DomainExceptionCode } from '../../../../../../../libs/exceptions/http';
import {
  BadRequestException,
  InternalServerException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';

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
      throw new NotFoundException('The post was not found');
    }

    if (post.status !== PostStatus.DRAFT) {
      throw new BadRequestException('You can only publish a draft');
    }

    if (!post.postMedias.length) {
      throw new BadRequestException("You can't post a post without a photo");
    }

    throw new InternalServerException("Couldn't publish the post");
  }
}
