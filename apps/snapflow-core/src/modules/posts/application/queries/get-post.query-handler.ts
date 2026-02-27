import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  PostsQueryRepository,
  PostWithMediaType,
} from '../../infrastructure/posts.query-repository';

export class GetPostQuery {
  constructor(
    public readonly postId: number,
    public readonly userId: number,
  ) {}
}

@QueryHandler(GetPostQuery)
export class GetPostQueryHandler implements IQueryHandler<GetPostQuery> {
  constructor(private readonly postsQueryRepository: PostsQueryRepository) {}

  async execute({ postId, userId }: GetPostQuery): Promise<PostWithMediaType | null> {
    return this.postsQueryRepository.getPostById(postId, userId);
  }
}
