import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, PostStatus } from '@generated/prisma';

const postWithMediaSelect = Prisma.validator<Prisma.PostSelect>()({
  id: true,
  description: true,
  postMedias: {
    select: {
      id: true,
      url: true,
      mimeType: true,
      size: true,
      position: true,
    },
  },
});

export type PostWithMediaType = Prisma.PostGetPayload<{ select: typeof postWithMediaSelect }>;

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPostById(id: number, userId: number): Promise<PostWithMediaType | null> {
    return this.prisma.post.findFirst({
      where: { userId, id, deletedAt: null, status: PostStatus.PUBLISHED },
      select: postWithMediaSelect,
    });
  }
}
