import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { GetPostQuery } from '../application/queries/get-post.query-handler';
import { PostVisibility } from '../enums/post-visibility.enum';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPostsQueryParamsDto } from '../api/input-dto/get-posts.query-params.dto';
import { SortDirection } from '../../../../../../libs/dto/base-query.params.dto';
import { GetProfilePostsQueryParamsDto } from '../api/input-dto/get-profile-posts-query-params.dto';
import { postInclude, PostWithInclude } from 'libs/prisma/post.include';

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProfilePosts(
    params: GetProfilePostsQueryParamsDto,
    userId: number,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      userId,
    };

    return this.findPaginatedPosts(where, params);
  }

  async findPosts(params: GetPostsQueryParamsDto): Promise<PaginatedViewDto<PostViewDto>> {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
    };

    return this.findPaginatedPosts(where, params);
  }

  async getPost(query: GetPostQuery): Promise<PostViewDto | null> {
    const where: Prisma.PostWhereInput = this.buildWhere(query);

    const post: PostWithInclude | null = await this.prisma.post.findFirst({
      where,
      include: postInclude,
    });

    return post ? PostViewDto.mapToView(post) : null;
  }

  private async findPaginatedPosts(
    where: Prisma.PostWhereInput,
    params: GetPostsQueryParamsDto | GetProfilePostsQueryParamsDto,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    const { pageNumber, pageSize, sortBy, sortDirection } = params;

    console.log({ sortBy, sortDirection });
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
