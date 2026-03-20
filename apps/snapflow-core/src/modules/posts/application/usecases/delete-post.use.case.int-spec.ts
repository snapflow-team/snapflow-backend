import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.use.case';
import { CreatePostUseCase } from './create-post-use.case';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';

describe('DeletePostUseCase', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let deletePostUseCase: DeletePostUseCase;
  let helper: IntTestHelper;

  let validateFilesMock: jest.Mock<
    Promise<ValidateFilesResponse>,
    [{ userId: number; fileIds: string[] }]
  >;
  let deleteFileMock: jest.Mock;

  beforeAll(async () => {
    validateFilesMock = jest.fn();
    deleteFileMock = jest.fn().mockResolvedValue(undefined);

    module = await Test.createTestingModule({
      imports: [SnapflowCoreModule],
    })
      .overrideProvider(FilesClient)
      .useValue({
        validateFiles: validateFilesMock,
        deleteFile: deleteFileMock,
      })
      .compile();

    deletePostUseCase = module.get<DeletePostUseCase>(DeletePostUseCase);
    const createPostUseCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    helper = new IntTestHelper(validateFilesMock, createPostUseCase);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  beforeEach(async () => {
    await prisma.postMedia.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.user.deleteMany({});
    validateFilesMock.mockClear();
    deleteFileMock.mockClear();
  });

  it('должен soft-delete опубликованный пост', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, {
      suffix: 'delete_published',
    });
    const fileId = '22222222-2222-4222-8222-222222222222';

    const postId: number = await helper.createPost(
      user.id,
      'Published post',
      fileId,
      PostStatus.PUBLISHED,
    );

    await deletePostUseCase.execute(new DeletePostCommand(user.id, postId));

    const deletedPost: Post | null = await prisma.post.findUnique({ where: { id: postId } });
    expect(deletedPost!.deletedAt).not.toBeNull();

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId, deletedAt: null },
    });
    expect(medias).toHaveLength(0);

    expect(deleteFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledWith({
      userId: user.id,
      fileUrl: `https://cdn.test/files/${fileId}`,
    });
  });

  it('должен кинуть NotFound если пост не существует', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, {
      suffix: 'not_found',
    });

    await expect(
      deletePostUseCase.execute(new DeletePostCommand(user.id, 999)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });

    expect(deleteFileMock).not.toHaveBeenCalled();
  });
});
