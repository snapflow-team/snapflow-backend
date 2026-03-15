import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.use.case';
import { CreatePostCommand, CreatePostUseCase } from './create-post-use.case';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';

describe('DeletePostUseCase', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let deletePostUseCase: DeletePostUseCase;
  let createPostUseCase: CreatePostUseCase;

  let validateFilesMock: jest.Mock<
    Promise<ValidateFilesResponse>,
    [{ userId: number; fileIds: string[] }]
  >;

  beforeAll(async () => {
    validateFilesMock = jest.fn() as unknown as jest.Mock<
      Promise<ValidateFilesResponse>,
      [{ userId: number; fileIds: string[] }]
    >;

    validateFilesMock.mockResolvedValue({
      valid: true,
      files: [{ fileId: 'f1', url: 'test.jpg', mimeType: 'image/jpeg', size: 1000 }],
    });

    module = await Test.createTestingModule({
      imports: [SnapflowCoreModule],
    })
      .overrideProvider(FilesClient)
      .useValue({
        validateFiles: validateFilesMock,
      })
      .compile();

    deletePostUseCase = module.get<DeletePostUseCase>(DeletePostUseCase);
    createPostUseCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await prisma.postMedia.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.user.deleteMany({});
    validateFilesMock.mockClear();
  });

  it('должен удалить опубликованный пост', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, {
      suffix: 'delete_published',
    });
    const fileIds: string[] = ['22222222-2222-4222-8222-222222222222'];

    const dto: CreatePostInputDto = {
      description: 'Published post to delete',
      fileIds,
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/png',
        size: 2000,
      })),
    });

    const postId: number = await createPostUseCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED),
    );

    await deletePostUseCase.execute(new DeletePostCommand(user.id, postId));

    const deletedPost: Post | null = await prisma.post.findUnique({ where: { id: postId } });
    expect(deletedPost!.deletedAt).not.toBeNull();

    // const medias: PostMedia[] = await prisma.postMedia.findMany({
    //   where: { postId, deletedAt: null },
    // });
    // expect(medias).toHaveLength(0);
    // TODO при удалении поста медиа не удаляются
  });

  it('должен кинуть NotFound если пост не найден или чужой', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_not_found' });

    await expect(
      deletePostUseCase.execute(new DeletePostCommand(user.id, 999)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
});
