import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { GetPostQuery, PostVisibility } from '../application/queries/get-post.query-handler';

const postInclude = Prisma.validator<Prisma.PostInclude>()({
  user: {
    select: {
      id: true,
      username: true,
    },
  },
  postMedias: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      url: true,
      mimeType: true,
      size: true,
      position: true,
    },
  },
});

export type PostWithInclude = Prisma.PostGetPayload<{ include: typeof postInclude }>;

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPost(query: GetPostQuery): Promise<PostViewDto | null> {
    const where: Prisma.PostWhereInput = this.buildWhere(query);

    const post: PostWithInclude | null = await this.prisma.post.findFirst({
      where,
      include: postInclude,
    });

    return post ? PostViewDto.mapToView(post) : null;
  }

  private buildWhere(query: GetPostQuery): Prisma.PostWhereInput {
    if (query.postVisibility === PostVisibility.Owner) {
      return {
        id: query.postId,
        userId: query.userId,
        deletedAt: null,
        status: { in: [PostStatus.DRAFT, PostStatus.PUBLISHED] },
      };
    }

    return {
      id: query.postId,
      deletedAt: null,
      status: PostStatus.PUBLISHED,
    };
  }
}
