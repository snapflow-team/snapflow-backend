import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PostStatus, Prisma } from '@generated/prisma-snapflow';
import { CreateMediaInput, PostWithMedia } from '../types/create-media.type';
import { CreatePostWithMediaRepositoryDto } from './dto/create-post-with-media.repository-dto';
import { UpdatePostRepositoryDto } from './dto/update-post.repository-dto';
import BatchPayload = Prisma.BatchPayload;

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async createPostWithMedia(dto: CreatePostWithMediaRepositoryDto): Promise<number> {
    const post: { id: number } = await this.prisma.post.create({
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

  async findByIdAndUser(postId: number, userId: number): Promise<PostWithMedia | null> {
    return this.prisma.post.findFirst({
      where: { id: postId, userId, deletedAt: null },
      include: { postMedias: { where: { deletedAt: null }, orderBy: { position: 'asc' } } },
    });
  }

  async findDraftByUserId(userId: number): Promise<PostWithMedia | null> {
    return this.prisma.post.findFirst({
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

  //TODO(vitaliy) добавить transaction client для возможных транзакций(по примеру usersRepository)
  async updatePost(dto: UpdatePostRepositoryDto): Promise<boolean> {
    const result: BatchPayload = await this.prisma.post.updateMany({
      where: { id: dto.postId, userId: dto.userId, deletedAt: null },
      data: { description: dto.description },
    });
    return result.count === 1;
  }

  async deletePost(id: number, userId: number): Promise<boolean> {
    const now = new Date();

    const result = await this.prisma.post.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: now },
    });

    await this.prisma.postMedia.updateMany({
      where: { postId: id, deletedAt: null },
      data: { deletedAt: now },
    });

    return result.count === 1;
  }
}
