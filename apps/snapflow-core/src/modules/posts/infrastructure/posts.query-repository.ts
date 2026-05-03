import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPostsQueryParamsDto } from '../api/input-dto/get-posts.query-params.dto';
import { SortDirection } from '../../../../../../libs/dto/base-query.params.dto';
import { PostWithMediaAndUserMetadata } from './types/post-with-media-and-user-metadata.type';

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserPosts(
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
              profiles: {
                where: { deletedAt: null },
                select: { id: true, avatarUrl: true },
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
      (p: PostWithMediaAndUserMetadata): PostViewDto => PostViewDto.mapToView(p),
    );
    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount,
      items,
    };
  }

  async findPosts(query: GetPostsQueryParamsDto): Promise<PaginatedViewDto<PostViewDto>> {
    const { pageNumber, pageSize, sortBy, sortDirection } = query;

    const [posts, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          deletedAt: null,
          status: PostStatus.PUBLISHED,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profiles: {
                where: { deletedAt: null },
                select: { id: true, avatarUrl: true },
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
        skip: query.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.post.count({
        where: {
          deletedAt: null,
          status: PostStatus.PUBLISHED,
        },
      }),
    ]);
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    const items: PostViewDto[] = posts.map(
      (post: PostWithMediaAndUserMetadata): PostViewDto => PostViewDto.mapToView(post),
    );
    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount,
      items,
    };
  }

  async findPostById(postId: number): Promise<PostViewDto | null> {
    const post: PostWithMediaAndUserMetadata | null = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISHED,
        deletedAt: null,
        user: { deletedAt: null },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profiles: {
              where: { deletedAt: null },
              select: { id: true, avatarUrl: true },
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

  async findDraftByUserId(userId: number): Promise<PostViewDto | null> {
    const post: PostWithMediaAndUserMetadata | null = await this.prisma.post.findFirst({
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
              select: { id: true, avatarUrl: true },
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

    return post ? PostViewDto.mapToView(post) : null;
  }
}
