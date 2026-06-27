import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostViewDto } from '../api/view-dto/post.view-dto';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPostsQueryParamsDto } from '../api/input-dto/get-posts.query-params.dto';
import { GetFeedQueryParamsDto } from '../api/input-dto/get-feed.query-params.dto';
import { GetUserPostsQueryParamsDto } from '../api/input-dto/get-user-posts.query-params.dto';
import { FeedPageViewDto } from '../api/view-dto/feed-page.view-dto';
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
import {
  PostWithMediaAndUserMetadata,
  postWithMediaAndUserMetadataInclude,
} from './types/post-with-media-and-user-metadata.type';

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFeedPosts(
    params: GetFeedQueryParamsDto,
    followingIds: number[],
    viewerId: number,
  ): Promise<FeedPageViewDto> {
    const { limit } = params;
    const cursorPayload: CursorPayload | undefined = params.cursor
      ? decodeCursor(params.cursor)
      : undefined;

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: PostStatus.PUBLISHED,
      userId: { in: followingIds },
      user: { deletedAt: null, isBanned: false },
      ...(cursorPayload
        ? (buildKeysetCursorFilter(cursorPayload, { parseId: Number }) as Prisma.PostWhereInput)
        : {}),
    };

    const posts: PostWithMediaAndUserMetadata[] = await this.prisma.post.findMany({
      where,
      include: postWithMediaAndUserMetadataInclude,
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated: CursorPaginatedResult<PostWithMediaAndUserMetadata> =
      buildCursorPaginatedResult(posts, limit, (post) => ({
        createdAt: post.createdAt,
        id: String(post.id),
      }));

    const likedPostIds = await this.getLikedPostIdsByViewer(
      paginated.items.map((post) => post.id),
      viewerId,
    );

    return {
      items: paginated.items.map((post) => PostViewDto.mapToView(post, likedPostIds.has(post.id))),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };
  }

  async findUserPosts(
    params: GetUserPostsQueryParamsDto,
    userId: number,
    viewerId?: number,
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
      include: postWithMediaAndUserMetadataInclude,
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated: CursorPaginatedResult<PostWithMediaAndUserMetadata> =
      buildCursorPaginatedResult(posts, limit, (post) => ({
        createdAt: post.createdAt,
        id: String(post.id),
      }));

    const likedPostIds = await this.getLikedPostIdsByViewer(
      paginated.items.map((post) => post.id),
      viewerId,
    );

    return {
      items: paginated.items.map((post) => PostViewDto.mapToView(post, likedPostIds.has(post.id))),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };
  }

  async findPosts(
    query: GetPostsQueryParamsDto,
    viewerId?: number,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    const { pageNumber, pageSize, sortBy, sortDirection } = query;

    const [posts, totalCount] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          deletedAt: null,
          status: PostStatus.PUBLISHED,
        },
        include: postWithMediaAndUserMetadataInclude,
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

    const likedPostIds = await this.getLikedPostIdsByViewer(
      posts.map((post) => post.id),
      viewerId,
    );

    const items: PostViewDto[] = posts.map((post) =>
      PostViewDto.mapToView(post, likedPostIds.has(post.id)),
    );
    return {
      pageSize,
      page: pageNumber,
      totalCount,
      pagesCount,
      items,
    };
  }

  async findPostById(postId: number, viewerId?: number): Promise<PostViewDto | null> {
    const post: PostWithMediaAndUserMetadata | null = await this.prisma.post.findFirst({
      where: {
        id: postId,
        status: PostStatus.PUBLISHED,
        deletedAt: null,
        user: { deletedAt: null },
      },
      include: postWithMediaAndUserMetadataInclude,
    });

    if (!post) {
      return null;
    }

    const isLikedByCurrentUser: boolean = viewerId ? await this.isLikedBy(postId, viewerId) : false;

    return PostViewDto.mapToView(post, isLikedByCurrentUser);
  }

  async findDraftByUserId(userId: number): Promise<PostViewDto | null> {
    const post: PostWithMediaAndUserMetadata | null = await this.prisma.post.findFirst({
      where: {
        userId,
        status: PostStatus.DRAFT,
        deletedAt: null,
      },
      include: postWithMediaAndUserMetadataInclude,
      orderBy: { createdAt: 'desc' },
    });

    return post ? PostViewDto.mapToView(post, false) : null;
  }

  private async isLikedBy(postId: number, viewerId: number): Promise<boolean> {
    const like = await this.prisma.postLike.findFirst({
      where: { postId, userId: viewerId, deletedAt: null },
      select: { id: true },
    });

    return like !== null;
  }

  private async getLikedPostIdsByViewer(
    postIds: number[],
    viewerId?: number,
  ): Promise<Set<number>> {
    if (viewerId === undefined || postIds.length === 0) {
      return new Set();
    }

    const likes = await this.prisma.postLike.findMany({
      where: {
        postId: { in: postIds },
        userId: viewerId,
        deletedAt: null,
      },
      select: { postId: true },
    });

    return new Set(likes.map((like) => like.postId));
  }
}
