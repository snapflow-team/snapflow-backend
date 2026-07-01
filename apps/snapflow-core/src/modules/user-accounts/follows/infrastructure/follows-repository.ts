import { Injectable } from '@nestjs/common';
import { Prisma, UserFollow } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class FollowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: number, followingId: number): Promise<void> {
    const existing: UserFollow | null = await this.prisma.userFollow.findFirst({
      where: { followerId, followingId },
    });

    if (existing?.deletedAt === null) {
      return;
    }

    if (existing) {
      await this.prisma.userFollow.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      return;
    }

    try {
      await this.prisma.userFollow.create({
        data: { followerId, followingId },
      });
    } catch (error) {
      if (!this.isFollowUniqueConstraintError(error)) {
        throw error;
      }

      const activeFollow: UserFollow | null = await this.prisma.userFollow.findFirst({
        where: { followerId, followingId, deletedAt: null },
      });

      if (activeFollow) {
        return;
      }

      const softDeletedFollow: UserFollow | null = await this.prisma.userFollow.findFirst({
        where: { followerId, followingId },
      });

      if (softDeletedFollow) {
        await this.prisma.userFollow.update({
          where: { id: softDeletedFollow.id },
          data: { deletedAt: null },
        });
      }
    }
  }

  async unfollow(followerId: number, followingId: number): Promise<void> {
    const existing: UserFollow | null = await this.prisma.userFollow.findFirst({
      where: { followerId, followingId, deletedAt: null },
    });

    if (!existing) {
      return;
    }

    await this.prisma.userFollow.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const follow = await this.prisma.userFollow.findFirst({
      where: { followerId, followingId, deletedAt: null },
      select: { id: true },
    });

    return follow !== null;
  }

  private isFollowUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const meta = error.meta;
    if (!meta) {
      return false;
    }

    if (meta['modelName'] === 'UserFollow') {
      return true;
    }

    const target = meta['target'];
    if (!target) {
      return false;
    }

    const matchesFollowIndex = (value: string): boolean =>
      value.includes('user_follows_follower_following_unique_active') ||
      (value.includes('follower_id') && value.includes('following_id'));

    return Array.isArray(target)
      ? target.some(matchesFollowIndex)
      : typeof target === 'string' && matchesFollowIndex(target);
  }
}
