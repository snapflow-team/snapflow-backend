import { GetPostQuery, GetPostQueryHandler } from './get-post.query-handler';
import { PrismaService } from '../../../../database/prisma.service';
import { FilesClient } from '../../../integrations/files/files.client';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { PostStatus } from '@generated/prisma-snapflow';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';

describe('GetPostQueryHandler', () => {
  let prisma: PrismaService;
  let queryHandler: GetPostQueryHandler;
  let testHelper: IntTestHelper;

  const validateFilesMock = jest.fn();

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule([
      {
        provide: FilesClient,
        useValue: {
          validateFiles: validateFilesMock,
        },
      },
    ]);
    prisma = testHelper.get<PrismaService>(PrismaService);
    queryHandler = testHelper.get<GetPostQueryHandler>(GetPostQueryHandler);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
  });

  it('(Success) должен вернуть опубликованный пост', async () => {
    const user = await testHelper.createUserWithProfile(prisma, 'get_public');
    const postId = await testHelper.createPost(user.id, ['f'], PostStatus.PUBLISHED, 'Public post');

    const foundPost = await queryHandler.execute(new GetPostQuery(postId, user.id));

    expect(foundPost).not.toBeNull();
    expect(foundPost.description).toBe('Public post');
    expect(foundPost.status).toBe(PostStatus.PUBLISHED);
  });

  it('(Not found) должен вернуть черновик только с для создателя и правильным userId', async () => {
    const user = await testHelper.createUserWithProfile(prisma, 'get_draft');

    const postId = await testHelper.createPost(user.id, ['f2'], PostStatus.DRAFT, 'Draft post');

    const post = await queryHandler.execute(new GetPostQuery(postId, user.id));

    expect(post).not.toBeNull();
    expect(post.description).toBe('Draft post');
    expect(post.status).toBe(PostStatus.DRAFT);

    const invalidUserId = 0;
    await expect(
      queryHandler.execute(new GetPostQuery(postId, invalidUserId)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });
  });

  it('(NotFound) должен выбросить ошибку для несуществующего поста', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'get_draft' });

    const invalidPostId = 0;
    await expect(
      queryHandler.execute(new GetPostQuery(invalidPostId, user.id)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });
  });
  it('(Not found) не должен возвращать удалённый пост', async () => {
    const user = await testHelper.createUserWithProfile(prisma, 'deleted');

    const postId = await testHelper.createPost(user.id, ['f'], PostStatus.PUBLISHED);

    await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    await expect(queryHandler.execute(new GetPostQuery(postId, user.id))).rejects.toMatchObject({
      code: 'NotFound',
    });
  });
});
