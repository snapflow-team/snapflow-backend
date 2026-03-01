import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostStatus } from '@generated/prisma';
import { PostViewDto, PostViewSource } from '../api/view-dto/post.view-dto';

@Injectable()
export class PostsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPostById(
    id: number,
    userId: number,
    statuses: PostStatus[],
  ): Promise<PostViewDto | null> {
    const post: PostViewSource | null = await this.prisma.post.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
        status: { in: statuses },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        postMedias: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            url: true,
            mimeType: true,
            size: true,
            position: true,
          },
        },
      },
    });

    if (!post) return null;

    return PostViewDto.mapToView(post);
  }

  async getPublicPost(id: number, status: PostStatus): Promise<PostViewDto | null> {
    const post: PostViewSource | null = await this.prisma.post.findFirst({
      where: {
        id,
        deletedAt: null,
        status: PostStatus.PUBLISHED,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        postMedias: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            url: true,
            mimeType: true,
            size: true,
            position: true,
          },
        },
      },
    });

    if (!post) return null;

    return PostViewDto.mapToView(post);
  }
}
