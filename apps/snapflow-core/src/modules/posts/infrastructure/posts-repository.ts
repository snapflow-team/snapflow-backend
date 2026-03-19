import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdatePostInputDto } from '../api/input-dto/update-post.input.dto';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import BatchPayload = Prisma.BatchPayload;

// todo: вынести в отдельную директорию
export type CreateMediaInput = {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
  position: number;
};

// todo: вынести в отдельную директорию
export type PostWithMedia = Prisma.PostGetPayload<{ include: { postMedias: true } }>;

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // todo: вынести параметры в dto
  async createPostWithMedia(params: {
    userId: number;
    description?: string;
    status: PostStatus;
    medias: CreateMediaInput[];
  }): Promise<number> {
    const post: { id: number } = await this.prisma.post.create({
      data: {
        userId: params.userId,
        description: params.description,
        status: params.status,
        postMedias: {
          create: params.medias.map((media: CreateMediaInput) => ({
            fileId: media.fileId,
            url: media.url,
            mimeType: media.mimeType,
            size: media.size,
            position: media.position,
          })),
        },
      },
      select: { id: true },
    });
    return post.id;
  }

  async findByIdAndUser(postId: number, userId: number): Promise<PostWithMedia | null> {
    return this.prisma.post.findFirst({
      where: { id: postId, userId, deletedAt: null },
      include: { postMedias: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    });
  }

  async publishDraft(postId: number, userId: number): Promise<boolean> {
    const result: BatchPayload = await this.prisma.post.updateMany({
      where: {
        id: postId,
        userId,
        status: PostStatus.DRAFT,
        deletedAt: null,
        postMedias: {
          some: { deletedAt: null },
        },
      },
      data: {
        status: PostStatus.PUBLISHED,
      },
    });
    return result.count === 1;
  }

  async updatePost(id: number, userId: number, dto: UpdatePostInputDto): Promise<boolean> {
    const result: BatchPayload = await this.prisma.post.updateMany({
      where: { id, userId, deletedAt: null },
      data: { description: dto.description },
    });
    return result.count === 1;
  }

  async deletePost(id: number, userId: number): Promise<boolean> {
    const result: BatchPayload = await this.prisma.post.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return result.count === 1;
  }
}
