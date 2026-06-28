import { PrismaService } from '../../src/database/prisma.service';
import { Server } from 'http';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { UserFollow } from '@generated/prisma-snapflow';

export class FollowTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  async follow(accessToken: string, targetUserId: number): Promise<void> {
    await request(this.server)
      .post(`/${GLOBAL_PREFIX}/users/${targetUserId}/follow`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);
  }

  async unfollow(accessToken: string, targetUserId: number): Promise<void> {
    await request(this.server)
      .delete(`/${GLOBAL_PREFIX}/users/${targetUserId}/follow`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);
  }

  async findFollowRecord(followerId: number, followingId: number): Promise<UserFollow | null> {
    return this.prisma.userFollow.findFirst({
      where: { followerId, followingId },
    });
  }

  async isActiveFollow(followerId: number, followingId: number): Promise<boolean> {
    const follow = await this.findFollowRecord(followerId, followingId);

    return follow !== null && follow.deletedAt === null;
  }
}
