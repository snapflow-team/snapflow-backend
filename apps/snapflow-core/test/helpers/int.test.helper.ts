import {
  CreatePostCommand,
  CreatePostUseCase,
} from '../../src/modules/posts/application/usecases/create-post-use.case';
import { PostStatus } from '@generated/prisma-snapflow';

export class IntTestHelper {
  constructor(
    private readonly validateFilesMock: jest.Mock,
    private readonly useCase: CreatePostUseCase,
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

  async createPost(
    userId: number,
    description: string,
    fileId: string,
    status: PostStatus = PostStatus.PUBLISHED,
  ) {
    this.mockFileValidation(fileId);
    return this.useCase.execute(
      new CreatePostCommand({ description, fileIds: [fileId] }, userId, status),
    );
  }
}
