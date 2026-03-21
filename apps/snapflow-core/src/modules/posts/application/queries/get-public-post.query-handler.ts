import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../../infrastructure/posts.query-repository';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';

export class GetPublicPostQuery {
  constructor(public readonly postId: number) {}
}

@QueryHandler(GetPublicPostQuery)
export class GetPublicPostQueryHandler implements IQueryHandler<GetPublicPostQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ postId }: GetPublicPostQuery): Promise<PostViewDto> {
    const post: PostViewDto | null = await this.postsQueryRepository.findPublicPost(postId);

    if (!post) {
      throw new NotFoundException('The post was not found');
    }
    return post;
  }
}
