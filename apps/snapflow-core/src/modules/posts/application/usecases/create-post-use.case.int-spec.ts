import { Post, PostMedia, PostStatus, User } from '@generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import { CreatePostCommand, CreatePostUseCase } from './create-post-use.case';
import { Test, TestingModule } from '@nestjs/testing';

import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { FilesClient } from '../../../integrations/files/files.client';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';

describe('CreatePostUseCase (Интеграция)', () => {
  let module: TestingModule;
  let useCase: CreatePostUseCase;
  let prisma: PrismaService;

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
        validateFiles: validateFilesMock, // метод из useCase
      })
      .compile();

    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
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

  it('должен создать опубликованный пост с медиа при успешной валидации файлов', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_ok' });
    const fileIds: string[] = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    const dto: CreatePostInputDto = {
      description: 'Post description',
      fileIds,
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId, index) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1000 + index,
      })),
    });

    const postId: number = await useCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED),
    );

    expect(validateFilesMock).toHaveBeenCalledTimes(1);
    expect(validateFilesMock).toHaveBeenCalledWith({ userId: user.id, fileIds });

    const post: Post | null = await prisma.post.findUnique({ where: { id: postId } });
    expect(post).not.toBeNull();
    expect(post!.userId).toBe(user.id);
    expect(post!.status).toBe(PostStatus.PUBLISHED);
    expect(post!.description).toBe(dto.description);

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    expect(medias).toHaveLength(2);
    expect(medias[0].fileId).toBe(fileIds[0]);
    expect(medias[0].position).toBe(0);
    expect(medias[1].fileId).toBe(fileIds[1]);
    expect(medias[1].position).toBe(1);
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

    const postId: number = await useCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.DRAFT),
    );
    const post: Post | null = await prisma.post.findUnique({ where: { id: postId } });

    expect(post).not.toBeNull();
    expect(post!.status).toBe(PostStatus.DRAFT);
  });

  it('должен выбросить BadRequest, если файлы невалидны или принадлежат другому пользователю', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_inv' });
    const dto: CreatePostInputDto = {
      fileIds: ['44444444-4444-4444-8444-444444444444'],
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: false,
      files: [],
    });

    await expect(
      useCase.execute(new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED)),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'Another user has some files',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('должен выбросить BadRequest, если validateFiles возвращает пустой список файлов', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_emp' });
    const dto: CreatePostInputDto = {
      fileIds: ['55555555-5555-4555-8555-555555555555'],
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: [],
    });

    await expect(
      useCase.execute(new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED)),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: "You can't publish a post without media",
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('должен выбросить BadRequest при пустом fileIds и не вызывать файловый сервис', async () => {
    const user: User = await TestEntityFactory.createTestUser(prisma, { suffix: 'post_no_files' });
    const dto: CreatePostInputDto = {
      fileIds: [],
    };

    await expect(
      useCase.execute(new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED)),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: "You can't publish a post without media",
    });

    expect(validateFilesMock).not.toHaveBeenCalled();
    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
});
