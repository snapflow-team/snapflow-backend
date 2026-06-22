import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class FollowsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isFollowing(viewerId: number, targetUserId: number): Promise<boolean> {
    const follow = await this.prisma.userFollow.findFirst({
      where: { followerId: viewerId, followingId: targetUserId, deletedAt: null },
      select: { id: true },
    });

    return follow !== null;
  }

  async getFollowingUserIds(userId: number): Promise<number[]> {
    const follows = await this.prisma.userFollow.findMany({
      where: { followerId: userId, deletedAt: null },
      select: { followingId: true },
      orderBy: { createdAt: 'desc' },
    });

    return follows.map((follow) => follow.followingId);
  }
}
