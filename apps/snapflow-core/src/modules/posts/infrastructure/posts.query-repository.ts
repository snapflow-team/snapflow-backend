import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPostsQueryParamsDto } from '../api/input-dto/get-posts.query-params.dto';
import { GetUserPostsQueryParamsDto } from '../api/input-dto/get-user-posts.query-params.dto';
import { UserPostsPageViewDto } from '../api/view-dto/user-posts-page.view-dto';
import { SortDirection } from '../../../../../../libs/dto/base-query.params.dto';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PostWithMediaAndUserMetadata } from './types/post-with-media-and-user-metadata.type';

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserPosts(
    params: GetUserPostsQueryParamsDto,
    userId: number,
  ): Promise<UserPostsPageViewDto> {
    const { limit } = params;
    const cursorPayload: CursorPayload | undefined = params.cursor
      ? decodeCursor(params.cursor)
      : undefined;

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      userId,
      ...(cursorPayload
        ? (buildKeysetCursorFilter(cursorPayload, { parseId: Number }) as Prisma.PostWhereInput)
        : {}),
    };

    const posts: PostWithMediaAndUserMetadata[] = await this.prisma.post.findMany({
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
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated: CursorPaginatedResult<PostWithMediaAndUserMetadata> =
      buildCursorPaginatedResult(posts, limit, (post) => ({
        createdAt: post.createdAt,
        id: String(post.id),
      }));

    return {
      items: paginated.items.map((p) => PostViewDto.mapToView(p)),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
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
