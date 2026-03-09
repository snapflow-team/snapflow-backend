import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { BadRequestException, NotFoundException, } from '../../../../common/exceptions/domain-exceptions';

export enum PostVisibility {
  Owner = 'owner',
  Public = 'public',
}
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

  async execute(query: GetPostQuery): Promise<PostViewDto> {
    if (query.postVisibility === PostVisibility.Owner && !query.userId) {
      throw new BadRequestException('The owner mode requires a userId');
    }

    const post: PostViewDto | null = await this.postsQueryRepository.getPost(query);

    if (!post) {
      throw new NotFoundException('The post was not found');
    }

    return post;
  }
}
