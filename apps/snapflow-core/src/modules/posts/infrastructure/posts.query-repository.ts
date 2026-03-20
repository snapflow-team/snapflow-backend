import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPostsQueryParamsDto } from '../api/input-dto/get-posts.query-params.dto';
import { SortDirection } from '../../../../../../libs/dto/base-query.params.dto';
import { postInclude, PostWithInclude } from 'libs/prisma/post.include';

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProfilePosts(
    params: GetPostsQueryParamsDto,
    userId: number,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      userId,
    };

    const { pageNumber, pageSize, sortBy, sortDirection } = params;

    const [items, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: {
          [sortBy]: sortDirection === SortDirection.Descending ? 'desc' : 'asc',
        },
        skip: params.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    return PaginatedViewDto.mapToView({
      items: items.map((post: PostWithInclude) => PostViewDto.mapToView(post)),
      page: pageNumber,
      size: pageSize,
      totalCount,
    });
  }

  async findPosts(params: GetPostsQueryParamsDto): Promise<PaginatedViewDto<PostViewDto>> {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
    };

    const { pageNumber, pageSize, sortBy, sortDirection } = params;

    const [posts, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: {
          [sortBy]: sortDirection === SortDirection.Descending ? 'desc' : 'asc',
        },
        skip: params.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    const items: PostViewDto[] = posts.map((post: PostWithInclude) => PostViewDto.mapToView(post));
    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount,
      items,
    };
  }

  async getPublicPost(postId: number): Promise<PostViewDto | null> {
    const post: PostWithInclude | null = await this.prisma.post.findFirst({
      where: { id: postId },
      include: postInclude,
    });

    return post ? PostViewDto.mapToView(post) : null;
  }

  async findDraftsByUserId(userId: number): Promise<PostViewDto[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        userId,
        status: PostStatus.DRAFT,
        deletedAt: null,
      },
      include: postInclude,
      orderBy: { createdAt: 'desc' },
    });

    return posts.map((post: PostWithInclude) => PostViewDto.mapToView(post));
  }

  async getPost(postId: number, userId: number): Promise<PostViewDto | null> {
    const post: PostWithInclude | null = await this.prisma.post.findFirst({
      where: { id: postId, userId, deletedAt: null },
      include: postInclude,
    });
    return post ? PostViewDto.mapToView(post) : null;
  }
}
