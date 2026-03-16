import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GetPostsQuery, GetPostsQueryHandler } from './get-posts.query-handler';
import { CreatePostUseCase } from '../usecases/create-post-use.case';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { PostStatus } from '@generated/prisma-snapflow';

describe('GetPostQueryHandler (INT)', () => {
  let prisma: PrismaService;
  let module: TestingModule;
  let handler: GetPostsQueryHandler;
  let useCase: CreatePostUseCase;
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

    handler = module.get<GetPostsQueryHandler>(GetPostsQueryHandler);
    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);
    intTestHelper = new IntTestHelper(validateFilesMock, useCase);
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

  it('должен вернуть 4 последних публик поста', async () => {
    const user1 = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-1' });
    const user2 = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-2' });
    const user3 = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-3' });

    await intTestHelper.createPost(user1.id, 'Пост #10 (самый старый)', 'f10');
    await intTestHelper.createPost(user2.id, 'Пост #9', 'f9');
    await intTestHelper.createPost(user3.id, 'Пост #8', 'f8');
    await intTestHelper.createPost(user1.id, 'Пост #7', 'f7');
    await intTestHelper.createPost(user2.id, 'Пост #6', 'f6');
    await intTestHelper.createPost(user3.id, 'Пост #5', 'f5');
    await intTestHelper.createPost(user1.id, 'Пост #4', 'f4');
    await intTestHelper.createPost(user2.id, 'Пост #3', 'f3');
    await intTestHelper.createPost(user3.id, 'Пост #2', 'f2');
    await intTestHelper.createPost(user1.id, 'Пост #1 (самый новый)', 'f1');

    const result = await handler.execute(new GetPostsQuery(1, 4));

    expect(result.items).toHaveLength(4);
    expect(result.items.map((p) => p.description)).toEqual([
      'Пост #1 (самый новый)',
      'Пост #2',
      'Пост #3',
      'Пост #4',
    ]);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
    expect(result.totalCount).toBe(10);
    expect(result.pagesCount).toBe(3);
  });

  it('должен вернуть пустой список, если обупликованных постов нет', async () => {
    const result = await handler.execute(new GetPostsQuery(1, 4));

    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.pagesCount).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
  });

  it('должен возвращать только публик посты', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'drafts' });

    await intTestHelper.createPost(user.id, 'DraftPost', 'f1', PostStatus.DRAFT);
    await intTestHelper.createPost(user.id, 'PublicPost', 'f2', PostStatus.PUBLISHED);

    const result = await handler.execute(new GetPostsQuery(1, 4));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('PublicPost');
    expect(result.totalCount).toBe(1);
  });

  it('должен игнорировать удалённые посты', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'deleted' });

    await intTestHelper.createPost(user.id, 'Видимый пост', 'f1');

    const deletedPost = await prisma.post.create({
      data: {
        description: 'Удалённый пост',
        status: PostStatus.PUBLISHED,
        userId: user.id,
        deletedAt: new Date(),
      },
    });

    const result = await handler.execute(new GetPostsQuery(1, 4));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Видимый пост');
    expect(result.totalCount).toBe(1);
  });
});
