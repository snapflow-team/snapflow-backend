import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '../../../../../common/exceptions/domain-exceptions';
import { PostsRepository } from '../../../infrastructure/posts-repository';
import { CommentsQueryRepository } from '../../infrastructure/comments.query-repository';
import { GetPostCommentsQueryParamsDto } from '../../api/input-dto/get-post-comments.query-params.dto';
import { PostCommentsPageViewDto } from '../../api/view-dto/post-comments-page.view-dto';
import { Post } from '@generated/prisma-snapflow';

export class GetPostCommentsQuery {
  constructor(
    public readonly query: GetPostCommentsQueryParamsDto,
    public readonly postId: number,
    public readonly viewerId?: number,
  ) {}
}

@QueryHandler(GetPostCommentsQuery)
export class GetPostCommentsQueryHandler implements IQueryHandler<GetPostCommentsQuery> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commentsQueryRepository: CommentsQueryRepository,
  ) {}

  async execute({
    query,
    postId,
    viewerId,
  }: GetPostCommentsQuery): Promise<PostCommentsPageViewDto> {
    const post: Post | null = await this.postsRepository.findById(postId);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.commentsQueryRepository.findPostComments(postId, query, viewerId);
  }
}
