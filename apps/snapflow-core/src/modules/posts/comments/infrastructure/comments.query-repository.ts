import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { GetPostCommentsQueryParamsDto } from '../api/input-dto/get-post-comments.query-params.dto';
import { CommentItemViewDto } from '../api/view-dto/comment-item.view-dto';
import { PostCommentsPageViewDto } from '../api/view-dto/post-comments-page.view-dto';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import {
  CommentWithUserMetadata,
  commentWithUserMetadataInclude,
} from './types/comment-with-user-metadata.type';

@Injectable()
export class CommentsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(commentId: number): Promise<CommentItemViewDto | null> {
    const comment: CommentWithUserMetadata | null = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: commentWithUserMetadataInclude,
    });

    return comment ? CommentItemViewDto.mapToView(comment) : null;
  }

  async findPostComments(
    postId: number,
    params: GetPostCommentsQueryParamsDto,
    viewerId?: number,
  ): Promise<PostCommentsPageViewDto> {
    const { limit } = params;
    const cursorPayload: CursorPayload | undefined = params.cursor
      ? decodeCursor(params.cursor)
      : undefined;

    const where: Prisma.CommentWhereInput = {
      postId,
      parentId: null,
      deletedAt: null,
      ...(cursorPayload
        ? (buildKeysetCursorFilter(cursorPayload, { parseId: Number }) as Prisma.CommentWhereInput)
        : {}),
    };

    const comments: CommentWithUserMetadata[] = await this.prisma.comment.findMany({
      where,
      include: commentWithUserMetadataInclude,
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated: CursorPaginatedResult<CommentWithUserMetadata> = buildCursorPaginatedResult(
      comments,
      limit,
      (comment) => ({
        createdAt: comment.createdAt,
        id: String(comment.id),
      }),
    );

    const likedCommentIds = await this.getLikedCommentIdsByViewer(
      paginated.items.map((comment) => comment.id),
      viewerId,
    );

    return {
      items: paginated.items.map((comment) =>
        CommentItemViewDto.mapToView(comment, likedCommentIds.has(comment.id)),
      ),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };
  }

  async findCommentReplies(
    postId: number,
    commentId: number,
    params: GetPostCommentsQueryParamsDto,
  ): Promise<PostCommentsPageViewDto> {
    const { limit } = params;
    const cursorPayload: CursorPayload | undefined = params.cursor
      ? decodeCursor(params.cursor)
      : undefined;

    const where: Prisma.CommentWhereInput = {
      postId,
      parentId: commentId,
      deletedAt: null,
      ...(cursorPayload
        ? (buildKeysetCursorFilter(cursorPayload, { parseId: Number }) as Prisma.CommentWhereInput)
        : {}),
    };

    const comments: CommentWithUserMetadata[] = await this.prisma.comment.findMany({
      where,
      include: commentWithUserMetadataInclude,
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated: CursorPaginatedResult<CommentWithUserMetadata> = buildCursorPaginatedResult(
      comments,
      limit,
      (comment) => ({
        createdAt: comment.createdAt,
        id: String(comment.id),
      }),
    );

    return {
      items: paginated.items.map((comment) => CommentItemViewDto.mapToView(comment)),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };
  }

  private async getLikedCommentIdsByViewer(
    commentIds: number[],
    viewerId?: number,
  ): Promise<Set<number>> {
    if (viewerId === undefined || commentIds.length === 0) {
      return new Set();
    }

    const likes = await this.prisma.commentLike.findMany({
      where: {
        commentId: { in: commentIds },
        userId: viewerId,
        deletedAt: null,
      },
      select: { commentId: true },
    });

    return new Set(likes.map((like) => like.commentId));
  }
}
