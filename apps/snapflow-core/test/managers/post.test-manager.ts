import { PrismaService } from '../../src/database/prisma.service';
import { CreatePostInputDto } from '../../src/modules/posts/api/input-dto/create-post.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { PostStatus } from '@generated/prisma-snapflow';

export class PostTestManager {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(
    userId: number,
    inputDtos: CreatePostInputDto[] = [],
    count: number = 1,
  ): Promise<void> {
    const dtos: CreatePostInputDto[] =
      inputDtos.length > 0 ? inputDtos : TestDtoFactory.generateCreatePostInputDto(count);

    for (const dto of dtos) {
      await this.prisma.post.create({
        data: {
          userId,
          description: dto.description,
          status: PostStatus.PUBLISHED,
        },
      });
    }
  }
}
