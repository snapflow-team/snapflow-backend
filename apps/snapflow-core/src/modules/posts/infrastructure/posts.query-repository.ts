import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPostsQueryParamsDto } from '../api/input-dto/get-posts.query-params.dto';
import { SortDirection } from '../../../../../../libs/dto/base-query.params.dto';
import { PostWithInclude } from '../types/post-with-media.type';

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

    const [posts, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profiles: { where: { deletedAt: null }, select: { id: true } },
            },
          },
          postMedias: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              fileId: true,
              url: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortDirection === SortDirection.Descending ? 'desc' : 'asc',
        },
        skip: params.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    const pagesCount: number = Math.ceil(totalCount / pageSize);
    const items: PostViewDto[] = posts.map(
      (p: PostWithInclude): PostViewDto => PostViewDto.mapToView(p),
    );
    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount,
      items,
    };
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
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profiles: {
                where: { deletedAt: null },
                select: { id: true, username: true, firstName: true, lastName: true },
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
            },
          },
        },
        orderBy: {
          [sortBy]: sortDirection === SortDirection.Descending ? 'desc' : 'asc',
        },
        skip: params.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    const items: PostViewDto[] = posts.map(
      (post: PostWithInclude): PostViewDto => PostViewDto.mapToView(post),
    );
    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount,
      items,
    };
  }

  async findPublicPost(postId: number): Promise<PostViewDto | null> {
    const post: PostWithInclude | null = await this.prisma.post.findFirst({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profiles: {
              where: { deletedAt: null },
              select: { id: true, username: true, firstName: true, lastName: true },
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
          },
        },
      },
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
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profiles: {
              where: { deletedAt: null },
              select: { id: true, username: true, firstName: true, lastName: true },
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return posts.map((post: PostWithInclude) => PostViewDto.mapToView(post));
  }

  async findPost(postId: number, userId: number): Promise<PostViewDto | null> {
    const post: PostWithInclude | null = await this.prisma.post.findFirst({
      where: { id: postId, userId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profiles: {
              where: { deletedAt: null },
              select: { id: true, username: true, firstName: true, lastName: true },
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
          },
        },
      },
    });
    return post ? PostViewDto.mapToView(post) : null;
  }
}
