import { PrismaService } from '../../../../database/prisma.service';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.use.case';
import {
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
  Post,
  PostMedia,
  PostStatus,
  User,
} from '@generated/prisma-snapflow';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';

describe('DeletePostUseCase', () => {
  let prisma: PrismaService;
  let useCase: DeletePostUseCase;
  let testHelper: IntTestHelper;

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule();
    prisma = testHelper.get<PrismaService>(PrismaService);
    useCase = testHelper.get<DeletePostUseCase>(DeletePostUseCase);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
  });

  it('(Success) должен быть soft-delete опубликованного поста', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'del_ok');
    const fileIds = [
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ];

    const postId: number = await testHelper.createPost(
      user.id,
      fileIds,
      PostStatus.PUBLISHED,
      'Published post',
    );

    await useCase.execute(new DeletePostCommand(user.id, postId));

    const deletedPost: Post | null = await prisma.post.findUnique({ where: { id: postId } });
    expect(deletedPost).not.toBeNull();
    expect(deletedPost!.deletedAt).not.toBeNull();

    const medias: PostMedia[] = await prisma.postMedia.findMany({
      where: { postId, deletedAt: null },
    });
    expect(medias).toHaveLength(0);

    const outboxEvents: OutboxEvent[] = await prisma.outboxEvent.findMany({
      where: { type: OutboxEventType.DELETE_POST_MEDIA_FILE },
      orderBy: { createdAt: 'asc' },
    });
    expect(outboxEvents).toHaveLength(fileIds.length);
    expect(outboxEvents.every((event) => event.status === OutboxEventStatus.PENDING)).toBe(true);

    const expectedPayloads = fileIds.map((fileId) => ({
      userId: user.id,
      fileUrl: `https://cdn.test/files/${fileId}`,
    }));

    const actualPayloads = outboxEvents.map((event) => event.payload);
    expect(actualPayloads).toEqual(expect.arrayContaining(expectedPayloads));
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

    const outboxEventsCount: number = await prisma.outboxEvent.count();
    expect(outboxEventsCount).toBe(0);
  });
});
