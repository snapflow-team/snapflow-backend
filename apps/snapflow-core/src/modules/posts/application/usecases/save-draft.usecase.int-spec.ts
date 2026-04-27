import {
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
  Post,
  PostMedia,
  PostStatus,
  User,
} from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { FilesClient } from '../../../integrations/files/files.client';
import { SaveDraftCommand, SaveDraftUseCase } from './save-draft.usecase';
import { PostsRepository } from '../../infrastructure/posts-repository';

describe('SaveDraftUseCase (Интеграционные тесты)', () => {
  let useCase: SaveDraftUseCase;
  let prisma: PrismaService;
  let testHelper: IntTestHelper;
  let postsRepository: PostsRepository;
  const validateFilesMock = jest.fn();

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule([
      {
        provide: FilesClient,
        useValue: { validateFiles: validateFilesMock },
      },
    ]);

    useCase = testHelper.get<SaveDraftUseCase>(SaveDraftUseCase);
    prisma = testHelper.get<PrismaService>(PrismaService);
    postsRepository = testHelper.get<PostsRepository>(PostsRepository);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
    validateFilesMock.mockReset();
  });

  it('(Success) должен создать первый черновик, если у пользователя не было DRAFT', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'dr_first');
    const fileIds: string[] = [
      '61111111-1111-4111-8111-111111111111',
      '62222222-2222-4222-8222-222222222222',
    ];
    const description = 'My first draft';

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1000,
      })),
    });

    await useCase.execute(
      new SaveDraftCommand({
        userId: user.id,
        description,
        fileIds,
      }),
    );

    const draft: Post | null = await prisma.post.findFirst({
      where: { userId: user.id, status: PostStatus.DRAFT, deletedAt: null },
    });
    expect(draft).not.toBeNull();
    expect(draft!.description).toBe(description);

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId: draft!.id, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    expect(medias).toHaveLength(fileIds.length);
    expect(medias.map((media) => media.fileId)).toEqual(fileIds);
    expect(medias.map((media) => media.position)).toEqual([0, 1]);

    const outboxEventsCount: number = await prisma.outboxEvent.count();
    expect(outboxEventsCount).toBe(0);
  });

  it('(Success) должен заменить существующий черновик и создать outbox события для старых медиа', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'dr_replace');
    const oldFileIds: string[] = [
      '71111111-1111-4111-8111-111111111111',
      '72222222-2222-4222-8222-222222222222',
    ];
    const newFileIds: string[] = ['73333333-3333-4333-8333-333333333333'];

    const { id: oldDraftId }: Post = await prisma.post.create({
      data: {
        userId: user.id,
        status: PostStatus.DRAFT,
        description: 'Old draft',
        postMedias: {
          create: oldFileIds.map((fileId, index) => ({
            fileId,
            url: `https://cdn.test/files/${fileId}`,
            mimeType: 'image/jpeg',
            size: 1000 + index,
            position: index,
          })),
        },
      },
    });

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: newFileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 2000,
      })),
    });

    await useCase.execute(
      new SaveDraftCommand({
        userId: user.id,
        description: 'New draft',
        fileIds: newFileIds,
      }),
    );

    const oldDraftAfter: Post | null = await prisma.post.findUnique({ where: { id: oldDraftId } });
    expect(oldDraftAfter).not.toBeNull();
    expect(oldDraftAfter!.deletedAt).not.toBeNull();

    const oldDraftActiveMedias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId: oldDraftId, deletedAt: null },
    });
    expect(oldDraftActiveMedias).toHaveLength(0);

    const newDraft: Post | null = await prisma.post.findFirst({
      where: {
        userId: user.id,
        status: PostStatus.DRAFT,
        deletedAt: null,
      },
      orderBy: { id: 'desc' },
    });
    expect(newDraft).not.toBeNull();
    expect(newDraft!.id).not.toBe(oldDraftId);
    expect(newDraft!.description).toBe('New draft');

    const newDraftMedias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId: newDraft!.id, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    expect(newDraftMedias).toHaveLength(1);
    expect(newDraftMedias[0].fileId).toBe(newFileIds[0]);
    expect(newDraftMedias[0].position).toBe(0);

    const outboxEvents: OutboxEvent[] = await prisma.outboxEvent.findMany({
      where: { type: OutboxEventType.DELETE_POST_MEDIA_FILE },
      orderBy: { createdAt: 'asc' },
    });
    expect(outboxEvents).toHaveLength(oldFileIds.length);
    expect(outboxEvents.every((event) => event.status === OutboxEventStatus.PENDING)).toBe(true);

    const expectedPayloads = oldFileIds.map((fileId) => ({
      userId: user.id,
      fileUrl: `https://cdn.test/files/${fileId}`,
    }));
    const actualPayloads = outboxEvents.map((event) => event.payload);
    expect(actualPayloads).toEqual(expect.arrayContaining(expectedPayloads));
  });

  it('(BadRequest) должен выбросить ошибку при пустом fileIds и не вызывать validateFiles', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'dr_empty');

    await expect(
      useCase.execute(
        new SaveDraftCommand({
          userId: user.id,
          description: 'No files',
          fileIds: [],
        }),
      ),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'Post requires at least one valid media file',
    });

    expect(validateFilesMock).not.toHaveBeenCalled();
    expect(await prisma.post.count()).toBe(0);
  });

  it('(BadRequest) должен выбросить ошибку когда validateFiles возвращает valid:false', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'dr_invalid');
    const fileIds = ['81111111-1111-4111-8111-111111111111'];

    validateFilesMock.mockResolvedValueOnce({
      valid: false,
      files: [],
    });

    await expect(
      useCase.execute(
        new SaveDraftCommand({
          userId: user.id,
          description: 'Invalid files',
          fileIds,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: "Couldn't confirm files upload",
    });

    expect(await prisma.post.count()).toBe(0);
  });

  it('(BadRequest) должен выбросить ошибку когда validateFiles возвращает files:[]', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'dr_no_valid');
    const fileIds = ['82222222-2222-4222-8222-222222222222'];

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: [],
    });

    await expect(
      useCase.execute(
        new SaveDraftCommand({
          userId: user.id,
          description: 'Empty files from validator',
          fileIds,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'Post requires at least one valid media file',
    });

    expect(await prisma.post.count()).toBe(0);
  });

  it('(Rollback) должен откатывать удаление старого черновика и outbox при падении createPostWithMedia', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'dr_rollback');
    const oldFileIds = [
      '91111111-1111-4111-8111-111111111111',
      '92222222-2222-4222-8222-222222222222',
    ];
    const newFileIds = ['93333333-3333-4333-8333-333333333333'];

    const oldDraft: Post = await prisma.post.create({
      data: {
        userId: user.id,
        status: PostStatus.DRAFT,
        description: 'Draft before rollback test',
        postMedias: {
          create: oldFileIds.map((fileId, index) => ({
            fileId,
            url: `https://cdn.test/files/${fileId}`,
            mimeType: 'image/jpeg',
            size: 1100 + index,
            position: index,
          })),
        },
      },
    });
    const oldDraftId: number = oldDraft.id;

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: newFileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 3000,
      })),
    });

    const createSpy = jest
      .spyOn(postsRepository, 'createPostWithMedia')
      .mockRejectedValueOnce(new Error('create failed in test'));

    await expect(
      useCase.execute(
        new SaveDraftCommand({
          userId: user.id,
          description: 'Should fail',
          fileIds: newFileIds,
        }),
      ),
    ).rejects.toThrow('create failed in test');

    createSpy.mockRestore();

    const oldDraftAfter: Post | null = await prisma.post.findUnique({ where: { id: oldDraftId } });
    expect(oldDraftAfter).not.toBeNull();
    expect(oldDraftAfter!.deletedAt).toBeNull();

    const oldMediasAfter: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId: oldDraftId },
      orderBy: { position: 'asc' },
    });
    expect(oldMediasAfter).toHaveLength(oldFileIds.length);
    expect(oldMediasAfter.every((media) => media.deletedAt === null)).toBe(true);

    const outboxEventsCount: number = await prisma.outboxEvent.count({
      where: { type: OutboxEventType.DELETE_POST_MEDIA_FILE },
    });
    expect(outboxEventsCount).toBe(0);

    const activeDrafts: Post[] = await prisma.post.findMany({
      where: { userId: user.id, status: PostStatus.DRAFT, deletedAt: null },
    });
    expect(activeDrafts).toHaveLength(1);
    expect(activeDrafts[0].id).toBe(oldDraftId);
  });
});
