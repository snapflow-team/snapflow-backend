import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';
import { PostsRepository } from '../../../infrastructure/posts-repository';
import { CommentsRepository } from '../../infrastructure/comments.repository';
import { CreateCommentApplicationDto } from '../dto/create-comment-application.dto';
import { Post } from '@generated/prisma-snapflow';

export class CreateCommentCommand {
  constructor(public readonly dto: CreateCommentApplicationDto) {}
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentUseCase implements ICommandHandler<CreateCommentCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commentsRepository: CommentsRepository,
  ) {}

  async execute({ dto }: CreateCommentCommand): Promise<number> {
    const post: Post | null = await this.postsRepository.findById(dto.postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (dto.parentId !== null) {
      const parentExists: boolean = await this.commentsRepository.existsActiveByIdAndPostId(
        dto.parentId,
        dto.postId,
      );

      if (!parentExists) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    return this.commentsRepository.create(dto);
  }
}
