import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';

export class GetPostQuery {
  constructor(
    public readonly postId: number,
    public readonly viewerId?: number,
  ) {}
}

@QueryHandler(GetPostQuery)
export class GetPostQueryHandler implements IQueryHandler<GetPostQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ postId, viewerId }: GetPostQuery): Promise<PostViewDto> {
    const post: PostViewDto | null = await this.postsQueryRepository.findPostById(postId, viewerId);

    if (!post) {
      throw new NotFoundException('The post was not found');
    }

    return post;
  }
}
