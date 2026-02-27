import { Injectable } from '@nestjs/common';
import { PostStatus } from '@generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPostWithMedia(params: {
    userId: number;
    description?: string;
    medias: Array<{
      fileId: string;
      url: string;
      mimeType: string;
      size: number;
      position: number;
    }>;
  }) {
    return this.prisma.post.create({
      data: {
        userId: params.userId,
        description: params.description,
        status: PostStatus.PUBLISHED,
        postMedias: {
          create: params.medias.map((media) => ({
            fileId: media.fileId,
            url: media.url,
            mimeType: media.mimeType,
            size: media.size,
            position: media.position,
          })),
        },
      },
      include: { postMedias: true },
    });
  }
}
