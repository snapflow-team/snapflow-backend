import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../infrastructure/posts-repository';
import {
  InternalServerException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';
import { EditPostApplicationDto } from '../dto/edit-post-application.dto';
import { PostWithMedia } from '../../types/create-media.type';

export class EditPostCommand {
  constructor(public readonly dto: EditPostApplicationDto) {}
}

@CommandHandler(EditPostCommand)
export class EditPostUseCase implements ICommandHandler<EditPostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}
  async execute({ dto }: EditPostCommand): Promise<void> {
    const { userId, postId, description } = dto;
    const post: PostWithMedia | null = await this.postsRepository.findByIdAndUserId(postId, userId);

    if (!post) {
      throw new NotFoundException('The post was not found');
    }

    const isUpdated: boolean = await this.postsRepository.updatePost({
      postId,
      userId,
      description,
    });

    if (!isUpdated) {
      throw new InternalServerException('Failed to update post');
    }
  }
}
