import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { GetPostQuery } from '../application/queries/get-post.query-handler';
import { PostVisibility } from '../enums/post-visibility.enum';
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
