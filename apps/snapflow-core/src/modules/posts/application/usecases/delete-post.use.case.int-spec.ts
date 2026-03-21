import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.use.case';
import { CreatePostUseCase } from './create-post-use.case';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { ProfilesRepository } from '../../../user-accounts/users/profile/infrastructure/profiles.repository';

describe('DeletePostUseCase', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let useCase: CreatePostUseCase;
  let repo: ProfilesRepository;
  let deletePostUseCase: DeletePostUseCase;
  let intTestHelper: IntTestHelper;

  const validateFilesMock = jest.fn();
  const deleteFileMock = jest.fn();

  beforeAll(async () => {
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
    prisma = module.get<PrismaService>(PrismaService);
    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    repo = module.get<ProfilesRepository>(ProfilesRepository);
    intTestHelper = new IntTestHelper(validateFilesMock, useCase, repo);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  beforeEach(async () => {
    await prisma.postMedia.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.userProfile.deleteMany({});
    await prisma.user.deleteMany({});
    validateFilesMock.mockClear();
    deleteFileMock.mockReset();
  });

  it('должен soft-delete опубликованный пост', async () => {
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'del_ok');
    const fileId = '22222222-2222-4222-8222-222222222222';
    const fileUrl = `https://cdn.test/files/${fileId}`;

    const postId: number = await intTestHelper.createPost(
      user.id,
      [fileId],
      PostStatus.PUBLISHED,
      'Published post',
    );

    deleteFileMock.mockResolvedValueOnce({});

    await deletePostUseCase.execute(new DeletePostCommand(user.id, postId));

    const deletedPost: Post | null = await prisma.post.findUnique({ where: { id: postId } });
    expect(deletedPost).not.toBeNull();
    expect(deletedPost!.deletedAt).not.toBeNull();

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId, deletedAt: null },
    });
    expect(medias).toHaveLength(0);

    expect(deleteFileMock).toHaveBeenCalledTimes(1);
    expect(deleteFileMock).toHaveBeenCalledWith({
      userId: user.id,
      fileUrl,
    });
  });

  it('должен кинуть NotFound если пост не существует', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'not_found' });

    await expect(
      deletePostUseCase.execute(new DeletePostCommand(user.id, 999)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });

    expect(deleteFileMock).not.toHaveBeenCalled();
  });
});
