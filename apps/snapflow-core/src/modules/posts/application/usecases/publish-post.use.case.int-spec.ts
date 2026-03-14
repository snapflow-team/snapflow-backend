import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import { PublishPostCommand, PublishPostUseCase } from './publish-post.use.case';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { CreatePostCommand, CreatePostUseCase } from './create-post-use.case';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { FilesClient } from '../../../integrations/files/files.client';

describe('PublishPostUseCase (Int)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let publishUseCase: PublishPostUseCase;
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

    publishUseCase = module.get<PublishPostUseCase>(PublishPostUseCase);
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

  it('должен создать черновик поста при переданном статусе DRAFT', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_draft' });
    const dto: CreatePostInputDto = {
      fileIds: ['33333333-3333-4333-8333-333333333333'],
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: [
        {
          fileId: dto.fileIds[0],
          url: `https://cdn.test/files/${dto.fileIds[0]}`,
          mimeType: 'image/png',
          size: 2000,
        },
      ],
    });

    const postId: number = await createPostUseCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.DRAFT),
    );
    const post: Post | null = await prisma.post.findUnique({ where: { id: postId } });

    expect(post).not.toBeNull();
    expect(post!.status).toBe(PostStatus.DRAFT);
  });

  it('должен опубликовать черновик с медиа', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_publish' });
    const fileIds: string[] = ['66666666-6666-4666-8666-666666666666'];

    const dto: CreatePostInputDto = {
      description: 'Draft to publish',
      fileIds,
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1234,
      })),
    });

    // создаём черновик
    const draftPostId: number = await createPostUseCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.DRAFT),
    );

    const draft: Post | null = await prisma.post.findUnique({ where: { id: draftPostId } });
    expect(draft).not.toBeNull();
    expect(draft!.status).toBe(PostStatus.DRAFT);

    // публикуем черновик
    const publishedPostId = await publishUseCase.execute(
      new PublishPostCommand(draftPostId, user.id),
    );

    expect(publishedPostId).toBe(draftPostId);

    const published: Post | null = await prisma.post.findUnique({ where: { id: draftPostId } });
    expect(published).not.toBeNull();
    expect(published!.status).toBe(PostStatus.PUBLISHED);
    expect(published!.description).toBe(dto.description);

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId: draftPostId, deletedAt: null },
    });
    expect(medias).toHaveLength(1);
    expect(medias[0].fileId).toBe(fileIds[0]);
  });

  it('должен выбросить NotFoundException если пост не найден или чужой', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_notfound' });

    await expect(
      publishUseCase.execute(new PublishPostCommand(999, user.id)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('должен выбросить BadRequestException если пост уже опубликован', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_published' });
    const fileIds: string[] = ['77777777-7777-4777-8777-777777777777'];

    const dto: CreatePostInputDto = { fileIds };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1234,
      })),
    });

    // создаём уже опубликованный пост
    const postId: number = await createPostUseCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED),
    );

    await expect(
      publishUseCase.execute(new PublishPostCommand(postId, user.id)),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'You can only publish a draft',
    });
  });
});
