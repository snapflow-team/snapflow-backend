import {
  CreatePostCommand,
  CreatePostUseCase,
} from '../../src/modules/posts/application/usecases/create-post-use.case';
import { PostStatus } from '@generated/prisma-snapflow';
import { ProfilesRepository } from '../../src/modules/user-accounts/users/profile/infrastructure/profiles.repository';
import { PrismaService } from '../../src/database/prisma.service';
import { TestEntityFactory } from './test-entity.factory';

export class IntTestHelper {
  constructor(
    private readonly validateFilesMock: jest.Mock,
    private readonly useCase: CreatePostUseCase,
    private readonly profilesRepo: ProfilesRepository,
  ) {}

  mockFileValidation(fileId: string) {
    this.validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: [
        {
          fileId,
          url: `https://cdn.test/files/${fileId}`,
          mimeType: 'image/jpeg',
          size: 1000,
        },
      ],
    });
  }

  async createUserWithProfile(prisma: PrismaService, suffix: string) {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix });
    const profileId = (
      await this.profilesRepo.createProfile({ userId: user.id, username: user.username })
    ).id;
    await this.profilesRepo.updateProfile({
      profileId,
      username: `user_${suffix}`,
      firstName: `First_${suffix}`,
      lastName: `Last_${suffix}`,
      dateOfBirth: new Date(),
      country: 'Russia',
      city: 'Moscow',
      aboutMe: `About me ${suffix}`,
    });
    return user;
  }

  async createPost(
    userId: number,
    fileIds: string[],
    status: PostStatus = PostStatus.PUBLISHED,
    description?: string,
  ) {
    this.validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId, index) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1000 + index,
      })),
    });
    return this.useCase.execute(
      new CreatePostCommand({
        userId,
        status,
        description,
        fileIds,
      }),
    );
  }

  async createSession(prisma: PrismaService, userId: number, deviceId: string) {
    return prisma.session.create({
      data: {
        userId,
        deviceId,
        deviceName: 'Test Device',
        ip: '127.0.0.1',
        iat: new Date(),
        exp: new Date(Date.now() + 1000 * 60 * 60),
      },
    });
  }
}
