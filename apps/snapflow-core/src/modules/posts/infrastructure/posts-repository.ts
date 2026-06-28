import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Post, PostStatus, Prisma } from '@generated/prisma-snapflow';
import { CreateMediaInput, PostWithMedia } from '../types/create-media.type';
import { CreatePostWithMediaRepositoryDto } from './dto/create-post-with-media.repository-dto';
import { UpdatePostRepositoryDto } from './dto/update-post.repository-dto';
import BatchPayload = Prisma.BatchPayload;

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async createPostWithMedia(
    dto: CreatePostWithMediaRepositoryDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const post: { id: number } = await tx.post.create({
      data: {
        userId: dto.userId,
        description: dto.description,
        status: dto.status,
        postMedias: {
          create: dto.medias.map((media: CreateMediaInput) => ({
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

  async findById(postId: number): Promise<Post | null> {
    return this.prisma.post.findFirst({
      where: { id: postId, status: PostStatus.PUBLISHED, deletedAt: null },
    });
  }

  async findByIdAndUserId(postId: number, userId: number): Promise<PostWithMedia | null> {
    return this.prisma.post.findFirst({
      where: { id: postId, userId, deletedAt: null },
      include: { postMedias: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    });
  }

  async findDraftByUserId(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<PostWithMedia | null> {
    return tx.post.findFirst({
      where: {
        userId,
        status: PostStatus.DRAFT,
        deletedAt: null,
      },
      include: {
        postMedias: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async updatePost(dto: UpdatePostRepositoryDto): Promise<boolean> {
    const result: BatchPayload = await this.prisma.post.updateMany({
      where: { id: dto.postId, userId: dto.userId, deletedAt: null },
      data: { description: dto.description },
    });
    return result.count === 1;
  }

  async softDeletePostWithMedia(
    id: number,
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const now = new Date();

    const result: BatchPayload = await tx.post.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: now },
    });

    if (result.count !== 1) return false;

    await tx.postMedia.updateMany({
      where: { postId: id, deletedAt: null },
      data: { deletedAt: now },
    });

    return true;
  }
}
