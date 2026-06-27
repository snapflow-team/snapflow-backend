import { PostLike } from '@generated/prisma-snapflow';
import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { PrismaService } from '../../src/database/prisma.service';
import { PostViewDto } from '../../src/modules/posts/api/view-dto/post.view-dto';

export class PostLikeTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  async toggle(accessToken: string, postId: number): Promise<void> {
    await request(this.server)
      .post(`/${GLOBAL_PREFIX}/posts/${postId}/like`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NO_CONTENT);
  }

  async getPost(postId: number, accessToken?: string): Promise<PostViewDto> {
    const req = request(this.server).get(`/${GLOBAL_PREFIX}/posts/${postId}`);

    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }

    const res: Response = await req.expect(HttpStatus.OK);

    return res.body as PostViewDto;
  }

  async findLikeRecord(postId: number, userId: number): Promise<PostLike | null> {
    return this.prisma.postLike.findFirst({
      where: { postId, userId },
    });
  }

  async isActiveLike(postId: number, userId: number): Promise<boolean> {
    const like = await this.findLikeRecord(postId, userId);

    return like !== null && like.deletedAt === null;
  }

  async countLikeRecords(postId: number, userId: number): Promise<number> {
    return this.prisma.postLike.count({
      where: { postId, userId },
    });
  }
}
