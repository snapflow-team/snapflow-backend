import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { PostVisibility } from '../../enums/post-visibility.enum';
import {
  BadRequestException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';

export class GetPostQuery {
  constructor(
    public readonly postId: number,
    public readonly postVisibility: PostVisibility,
    public readonly userId?: number,
  ) {}
}

@QueryHandler(GetPostQuery)
export class GetPostQueryHandler implements IQueryHandler<GetPostQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ postId, postVisibility, userId }: GetPostQuery): Promise<PostViewDto> {
    if (postVisibility === PostVisibility.Owner && !userId) {
      throw new BadRequestException('The owner mode requires a userId');
    }

    const post: PostViewDto | null = await this.postsQueryRepository.getPost({
      postId,
      postVisibility,
      userId,
    });

    if (!post) {
      throw new NotFoundException('The post was not found');
    }

    return post;
  }
}
