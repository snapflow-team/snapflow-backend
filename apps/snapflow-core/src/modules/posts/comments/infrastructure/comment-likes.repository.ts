import { Injectable } from '@nestjs/common';
import { CommentLike } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class CommentLikesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCommentIdAndUserId(commentId: number, userId: number): Promise<CommentLike | null> {
    return this.prisma.commentLike.findFirst({
      where: { commentId, userId },
    });
  }

  async findActiveByCommentIdAndUserId(
    commentId: number,
    userId: number,
  ): Promise<CommentLike | null> {
    return this.prisma.commentLike.findFirst({
      where: { commentId, userId, deletedAt: null },
    });
  }

  async create(commentId: number, userId: number): Promise<CommentLike> {
    return this.prisma.commentLike.create({
      data: { commentId, userId },
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.commentLike.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number): Promise<void> {
    await this.prisma.commentLike.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
