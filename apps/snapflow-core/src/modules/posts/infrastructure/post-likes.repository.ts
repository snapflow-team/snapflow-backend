import { Injectable } from '@nestjs/common';
import { PostLike } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PostLikesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPostIdAndUserId(postId: number, userId: number): Promise<PostLike | null> {
    return this.prisma.postLike.findFirst({
      where: { postId, userId },
    });
  }

  async findActiveByPostIdAndUserId(postId: number, userId: number): Promise<PostLike | null> {
    return this.prisma.postLike.findFirst({
      where: { postId, userId, deletedAt: null },
    });
  }

  async create(postId: number, userId: number): Promise<PostLike> {
    return this.prisma.postLike.create({
      data: { postId, userId },
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.postLike.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number): Promise<void> {
    await this.prisma.postLike.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
