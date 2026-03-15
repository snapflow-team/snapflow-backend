import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import { CreatePostCommand, CreatePostUseCase } from './create-post-use.case';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostStatus, User } from '@generated/prisma-snapflow';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { EditPostCommand, EditPostUseCase } from './edit-post.use.case';
import { UpdatePostInputDto } from '../../api/input-dto/update-post.input.dto';

describe('EditPostUseCase (Int)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let editPostUseCase: EditPostUseCase;
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

    editPostUseCase = module.get<EditPostUseCase>(EditPostUseCase);
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

  it('должен обновить пост', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_draft' });
    const fileIds: string[] = ['11111111-1111-4111-8111-111111111111'];

    const createDto: CreatePostInputDto = {
      description: 'Original description',
      fileIds,
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1000,
      })),
    });

    const postId: number = await createPostUseCase.execute(
      new CreatePostCommand(createDto, user.id, PostStatus.DRAFT),
    );
    const updateDto: UpdatePostInputDto = {
      description: 'Updated description',
    };
    await editPostUseCase.execute(new EditPostCommand(user.id, postId, updateDto));

    const updatedPost = await prisma.post.findFirst({ where: { id: postId } });
    expect(updatedPost).not.toBeNull();
    expect(updatedPost!.description).toBe('Updated description');
  });

  it('должен выбросить NotFoundException если пост не найден или чужой', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_notfound' });

    const updateDto: UpdatePostInputDto = { description: 'test' };
    await expect(
      editPostUseCase.execute(new EditPostCommand(user.id, 999, updateDto)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
});
