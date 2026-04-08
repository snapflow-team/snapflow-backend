import { Post, PostMedia, PostStatus, User } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { CreatePostCommand, CreatePostUseCase } from './create-post-use.case';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { FilesClient } from '../../../integrations/files/files.client';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { EventBus } from '@nestjs/cqrs';
import { PostCreatedEvent } from '../../domain/events/post-created.event';

describe('CreatePostUseCase (Интеграционные тесты)', () => {
  let useCase: CreatePostUseCase;
  let prisma: PrismaService;
  let testHelper: IntTestHelper;
  let eventBus: EventBus;
  let publishSpy: jest.SpyInstance;
  const validateFilesMock = jest.fn();

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule([
      {
        provide: FilesClient,
        useValue: { validateFiles: validateFilesMock },
      },
    ]);

    useCase = testHelper.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = testHelper.get<PrismaService>(PrismaService);
    eventBus = testHelper.get<EventBus>(EventBus);

    publishSpy = jest.spyOn(eventBus, 'publish').mockImplementation(() => {});
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
    validateFilesMock.mockReset();
  });
  it('(BadRequest) должен выбросить ошибку при пустом fileIds, который отправлен в команду', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_no_files');

    await expect(
      useCase.execute(
        new CreatePostCommand({
          userId: user.id,
          status: PostStatus.PUBLISHED,
          fileIds: [],
        }),
      ),
    ).rejects.toMatchObject({ message: "You can't publish a post without media" });

    expect(validateFilesMock).not.toHaveBeenCalled();
    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
  it('(BadRequest) должен выбросить ошибку если профиль пользователя не найден', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_no_files');
    await prisma.userProfile.deleteMany({});

    await expect(
      useCase.execute(
        new CreatePostCommand({
          userId: user.id,
          status: PostStatus.PUBLISHED,
          fileIds: ['33333333-3333-4333-8333-333333333333'],
        }),
      ),
    ).rejects.toMatchObject({ message: 'Profile required to create post' });

    expect(validateFilesMock).not.toHaveBeenCalled();
    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('(Success) должен создать опубликованный пост с медиа при успешной валидации файлов', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_ok');

    const fileIds: string[] = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    const description = 'Post description';

    //Подменяем имплементацию для filesClient
    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => {
        return {
          fileId,
          url: `https://cdn.test/files/${fileId}`,
          mimeType: 'image/jpeg',
          size: 1000,
        };
      }),
    });

    const useCaseResult = await useCase.execute(
      new CreatePostCommand({
        userId: user.id,
        status: PostStatus.PUBLISHED,
        description: description,
        fileIds: fileIds,
      }),
    );

    expect(validateFilesMock).toHaveBeenCalledTimes(1);
    expect(validateFilesMock).toHaveBeenCalledWith({ userId: user.id, fileIds });

    const post: Post | null = await prisma.post.findUnique({ where: { id: useCaseResult } });
    expect(post).not.toBeNull();
    expect(post!.userId).toBe(user.id);
    expect(post!.status).toBe(PostStatus.PUBLISHED);
    expect(post!.description).toBe(description);

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId: useCaseResult, deletedAt: null },
      orderBy: { position: 'asc' },
    });

    expect(medias).toHaveLength(2);
    expect(medias[0].fileId).toBe(fileIds[0]);
    expect(medias[0].position).toBe(0);
    expect(medias[1].fileId).toBe(fileIds[1]);
    expect(medias[1].position).toBe(1);

    expect(publishSpy).toHaveBeenCalledWith(expect.any(PostCreatedEvent));
  });

  it('(Success) должен создать черновик поста при переданном статусе DRAFT', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_ok');
    const dto: CreatePostInputDto = {
      fileIds: ['33333333-3333-4333-8333-333333333333'],
      description: 'Some new description to post',
    };
    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: dto.fileIds.map((fileId) => {
        return {
          fileId,
          url: `https://cdn.test/files/${fileId}`,
          mimeType: 'image/jpeg',
          size: 1000,
        };
      }),
    });

    const postId: number = await useCase.execute(
      new CreatePostCommand({
        userId: user.id,
        status: PostStatus.DRAFT,
        description: dto.description,
        fileIds: dto.fileIds,
      }),
    );
    const post: Post | null = await prisma.post.findUnique({ where: { id: postId } });

    expect(post).not.toBeNull();
    expect(post!.status).toBe(PostStatus.DRAFT);

    expect(publishSpy).toHaveBeenCalledWith(expect.any(PostCreatedEvent));
  });

  it('(BadRequest) должен выбросить ошибку, если файлы невалидны или принадлежат другому пользователю', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_ok');

    const dto: CreatePostInputDto = {
      fileIds: ['44444444-4444-4444-8444-444444444444'],
    };

    validateFilesMock.mockResolvedValueOnce({
      valid: false,
      files: [],
    });

    await expect(
      useCase.execute(
        new CreatePostCommand({
          userId: user.id,
          status: PostStatus.PUBLISHED,
          description: dto.description,
          fileIds: dto.fileIds,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'Some files do not belong to you',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });

  it('(BadRequest) должен выбросить ошибку, если validateFiles возвращает пустой список файлов', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_emp');

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
});
