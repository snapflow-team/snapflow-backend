import { PrismaService } from '../../../../database/prisma.service';
import { GetPostsQuery, GetPostsQueryHandler } from './get-posts.query-handler';
import { FilesClient } from '../../../integrations/files/files.client';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { PostStatus } from '@generated/prisma-snapflow';
import { GetPostsQueryParamsDto } from '../../api/input-dto/get-posts.query-params.dto';

describe('GetPostQueryHandler (INT)', () => {
  let prisma: PrismaService;
  let handler: GetPostsQueryHandler;
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

    handler = testHelper.get<GetPostsQueryHandler>(GetPostsQueryHandler);
    prisma = testHelper.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
  });

  it('(Succese) должен вернуть 4 последних опубликованных поста', async () => {
    const user1 = await testHelper.createUserWithProfile(prisma, 'user-1');
    const user2 = await testHelper.createUserWithProfile(prisma, 'user-2');
    const user3 = await testHelper.createUserWithProfile(prisma, 'user-3');

    await testHelper.createPost(user1.id, ['f10'], undefined, 'Пост #10 (самый старый)');
    await testHelper.createPost(user2.id, ['f9'], undefined, 'Пост #9');
    await testHelper.createPost(user3.id, ['f8'], undefined, 'Пост #8');
    await testHelper.createPost(user1.id, ['f7'], undefined, 'Пост #7');
    await testHelper.createPost(user2.id, ['f6'], undefined, 'Пост #6');
    await testHelper.createPost(user3.id, ['f5'], undefined, 'Пост #5');
    await testHelper.createPost(user1.id, ['f4'], undefined, 'Пост #4');
    await testHelper.createPost(user2.id, ['f3'], undefined, 'Пост #3');
    await testHelper.createPost(user3.id, ['f2'], undefined, 'Пост #2');
    await testHelper.createPost(user1.id, ['f1'], undefined, 'Пост #1 (самый новый)');

    const dto = new GetPostsQueryParamsDto();
    dto.pageSize = 4;

    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toHaveLength(4);
    expect(result.items.map((p) => p.description)).toEqual([
      'Пост #1 (самый новый)',
      'Пост #2',
      'Пост #3',
      'Пост #4',
    ]);
    expect(result.items[0].owner).toEqual(
      expect.objectContaining({
        userId: expect.any(String),
        profileId: expect.any(String),
        username: expect.any(String),
      }),
    );
    expect(result.items[0].owner).not.toHaveProperty('ownerId');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
    expect(result.totalCount).toBe(10);
    expect(result.pagesCount).toBe(3);
  });

  it('(Success) должен вернуть пустой список, если обупликованных постов нет', async () => {
    const dto = new GetPostsQueryParamsDto();

    dto.pageSize = 4;
    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.pagesCount).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
  });

  it('(Success) должен возвращать только опубликованные посты', async () => {
    const user = await testHelper.createUserWithProfile(prisma, 'drafts');

    await testHelper.createPost(user.id, ['f1'], PostStatus.DRAFT, 'DraftPost');
    await testHelper.createPost(user.id, ['f2'], PostStatus.PUBLISHED, 'PublicPost');

    const dto = new GetPostsQueryParamsDto();

    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('PublicPost');
    expect(result.totalCount).toBe(1);
  });

  it('(Success) должен игнорировать удалённые посты', async () => {
    const user = await testHelper.createUserWithProfile(prisma, 'deleted');

    await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED, 'Видимый пост');

    const dto = new GetPostsQueryParamsDto();

    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Видимый пост');
    expect(result.totalCount).toBe(1);
  });
});
