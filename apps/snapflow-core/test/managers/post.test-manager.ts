import { PrismaService } from '../../src/database/prisma.service';
import { CreatePostInputDto } from '../../src/modules/posts/api/input-dto/create-post.input-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { PostStatus } from '@generated/prisma-snapflow';

export class PostTestManager {
  constructor(private readonly prisma: PrismaService) {}

  async createPublishedPost(
    userId: number,
    inputDtos: CreatePostInputDto[] = [],
    count: number = 1,
  ): Promise<void> {
    const dtos: CreatePostInputDto[] =
      inputDtos.length > 0 ? inputDtos : TestDtoFactory.generateCreatePostInputDto(count);

    for (const dto of dtos) {
      await this.prisma.userProfile.create({
        data: {
          userId,
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '2000-01-01T00:00:00.000Z',
          country: 'Germany',
          city: 'Berlin',
          aboutMe: 'Backend developer',
        },
      });
      await this.prisma.post.create({
        data: {
          userId,
          description: dto.description,
          status: PostStatus.PUBLISHED,
        },
      });
    }
    console.log('posts successfully created');
  }

  async createDraftPost(
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
          status: PostStatus.DRAFT,
        },
      });
    }
  }

  async createPublishedDeletedPost(
    userId: number,
    inputDtos: CreatePostInputDto[] = [],
    count: number = 1,
  ): Promise<void> {
    const dtos: CreatePostInputDto[] =
      inputDtos.length > 0 ? inputDtos : TestDtoFactory.generateCreatePostInputDto(count);

    for (const dto of dtos) {
      await this.prisma.userProfile.create({
        data: {
          userId,
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '2000-01-01T00:00:00.000Z',
          country: 'Germany',
          city: 'Berlin',
          aboutMe: 'Backend developer',
        },
      });
      await this.prisma.post.create({
        data: {
          userId,
          description: dto.description,
          status: PostStatus.PUBLISHED,
          deletedAt: new Date(),
        },
      });
    }
  }
}
