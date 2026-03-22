import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { CreatePostCommand, CreatePostUseCase } from './create-post-use.case';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { FilesClient } from '../../../integrations/files/files.client';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { ProfilesRepository } from '../../../user-accounts/users/profile/infrastructure/profiles.repository';

describe('CreatePostUseCase (Интеграция)', () => {
  let module: TestingModule;
  let useCase: CreatePostUseCase;
  let repo: ProfilesRepository;
  let prisma: PrismaService;
  let intTestHelper: IntTestHelper;

  const validateFilesMock = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [SnapflowCoreModule],
    })
      .overrideProvider(FilesClient)
      .useValue({
        validateFiles: validateFilesMock,
      })
      .compile();

    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);
    repo = module.get<ProfilesRepository>(ProfilesRepository);
    intTestHelper = new IntTestHelper(validateFilesMock, useCase, repo);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await prisma.postMedia.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.userProfile.deleteMany();
    await prisma.user.deleteMany({});
    validateFilesMock.mockClear();
    validateFilesMock.mockReset();
  });

  it('должен создать опубликованный пост с медиа при успешной валидации файлов', async () => {
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'post_ok');

    const fileIds: string[] = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    const dto: CreatePostInputDto = {
      description: 'Post description',
      fileIds,
    };

    const postId: number = await intTestHelper.createPost(
      user.id,
      fileIds,
      PostStatus.PUBLISHED,
      dto.description,
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
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'post_ok');
    const dto: CreatePostInputDto = {
      fileIds: ['33333333-3333-4333-8333-333333333333'],
    };

    const postId: number = await intTestHelper.createPost(user.id, dto.fileIds, PostStatus.DRAFT);
    const post: Post | null = await prisma.post.findUnique({ where: { id: postId } });

    expect(post).not.toBeNull();
    expect(post!.status).toBe(PostStatus.DRAFT);
  });

  it('должен выбросить BadRequest, если файлы невалидны или принадлежат другому пользователю', async () => {
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'post_ok');
    const dto: CreatePostInputDto = {
      fileIds: ['44444444-4444-4444-8444-444444444444'],
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: false,
      files: [],
    });

    await expect(
      intTestHelper.createPost(user.id, dto.fileIds, PostStatus.PUBLISHED),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'Some files do not belong to you',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('должен выбросить BadRequest, если validateFiles возвращает пустой список файлов', async () => {
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'post_emp');

    validateFilesMock.mockResolvedValueOnce({ valid: true, files: [] });

    await expect(
      useCase.execute(
        new CreatePostCommand({
          userId: user.id,
          status: PostStatus.PUBLISHED,
          fileIds: ['55555555-5555-4555-8555-555555555555'],
        }),
      ),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'Post requires at least one valid media file',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('должен выбросить BadRequest при пустом fileIds и не вызывать файловый сервис', async () => {
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'post_no_files');

    await expect(
      useCase.execute(
        new CreatePostCommand({
          userId: user.id,
          status: PostStatus.PUBLISHED,
          fileIds: [],
        }),
      ),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: "You can't publish a post without media",
    });

    expect(validateFilesMock).not.toHaveBeenCalled();
    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
});
