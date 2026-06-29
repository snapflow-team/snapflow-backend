import { Injectable } from '@nestjs/common';
import { Comment } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { CreateCommentApplicationDto } from '../application/dto/create-comment-application.dto';

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCommentApplicationDto): Promise<number> {
    const comment: { id: number } = await this.prisma.comment.create({
      data: {
        text: dto.text,
        postId: dto.postId,
        userId: dto.userId,
        parentId: dto.parentId,
      },
      select: { id: true },
    });

    return comment.id;
  }

  async findById(id: number): Promise<Comment | null> {
    return this.prisma.comment.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async existsActiveByIdAndPostId(id: number, postId: number): Promise<boolean> {
    const comment: { id: number } | null = await this.prisma.comment.findFirst({
      where: { id, postId, deletedAt: null },
      select: { id: true },
    });

    return comment !== null;
  }
}
