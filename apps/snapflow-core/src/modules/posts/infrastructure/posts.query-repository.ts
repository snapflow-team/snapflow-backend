import { Injectable } from '@nestjs/common';
import { PostStatus, Prisma } from '@generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { PostsPageViewDto } from '../api/view-dto/posts-page.view-dto';
import { GetPostQuery } from '../application/queries/get-post.query-handler';
import { PostVisibility } from '../enums/post-visibility.enum';

const postInclude = Prisma.validator<Prisma.PostInclude>()({
  user: {
    select: {
      id: true,
      username: true,
      profiles: {
        where: { deletedAt: null },
        select: {
          id: true,
        },
      },
    },
  },
  postMedias: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      fileId: true,
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

  async findProfilePublicPosts(params: {
    userId: number;
    pageNumber: number;
    pageSize: number;
  }): Promise<PostsPageViewDto> {
    const { userId, pageNumber, pageSize } = params;
    const skip = (pageNumber - 1) * pageSize;

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    const pagesCount = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: items.map((post) => PostViewDto.mapToView(post)),
    };
  }

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
