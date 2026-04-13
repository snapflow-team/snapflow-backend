import { PrismaService } from '../../../../database/prisma.service';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.use.case';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';

describe('DeletePostUseCase', () => {
  let prisma: PrismaService;
  let useCase: DeletePostUseCase;
  let testHelper: IntTestHelper;

  const validateFilesMock = jest.fn();
  const deleteFileMock = jest.fn();

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule([
      {
        provide: FilesClient,
        useValue: {
          validateFiles: validateFilesMock,
          deleteFile: deleteFileMock,
        },
      },
    ]);
    prisma = testHelper.get<PrismaService>(PrismaService);
    useCase = testHelper.get<DeletePostUseCase>(DeletePostUseCase);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
    validateFilesMock.mockReset();
    deleteFileMock.mockReset();
    deleteFileMock.mockClear();
  });

  it('(Success) должен быть soft-delete опубликованного поста', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'del_ok');
    const fileId = '22222222-2222-4222-8222-222222222222';
    const fileUrl = `https://cdn.test/files/${fileId}`;

    const postId: number = await testHelper.createPost(
      user.id,
      [fileId],
      PostStatus.PUBLISHED,
      'Published post',
    );

    deleteFileMock.mockResolvedValueOnce({});

    await useCase.execute(new DeletePostCommand(user.id, postId));

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

  it('(NotFound) должен выбросить ошибку если пост не существует', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'not_found');
    const invalidPostId = 0;
    await expect(
      useCase.execute(new DeletePostCommand(user.id, invalidPostId)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });

    expect(deleteFileMock).not.toHaveBeenCalled();
  });
});
