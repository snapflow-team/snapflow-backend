import { PrismaService } from '../../../../database/prisma.service';
import { FilesClient } from '../../../integrations/files/files.client';
import { PostStatus, User } from '@generated/prisma-snapflow';
import { GetUserPostsQuery, GetUserPostsQueryHandler } from './get-user-posts.query-handler';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { GetPostsQueryParamsDto, PostSortBy } from '../../api/input-dto/get-posts.query-params.dto';

describe('GetProfilePostsQueryHandler', () => {
  let handler: GetUserPostsQueryHandler;
  let prisma: PrismaService;
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
    handler = testHelper.get<GetUserPostsQueryHandler>(GetUserPostsQueryHandler);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
  });

  it('(Success) должен вернуть опубликованные посты профиля (DESC)', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'user-1');

    for (let i = 1; i <= 12; i++) {
      await testHelper.createPost(user.id, [`file-${i}`], PostStatus.PUBLISHED, `Post ${i}`);
    }

    const dto = new GetPostsQueryParamsDto();
    dto.pageNumber = 1;
    dto.pageSize = 8;
    dto.sortBy = PostSortBy.createdAt;

    const query = new GetUserPostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.items).toHaveLength(8);
    expect(result.items[0].description).toBe('Post 12');
    expect(result.items[7].description).toBe('Post 5');
    expect(result.items[0].owner).toEqual(
      expect.objectContaining({
        userId: expect.any(String),
        profileId: expect.any(String),
        username: expect.any(String),
      }),
    );
    expect(result.items[0].owner).not.toHaveProperty('ownerId');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);
    expect(result.totalCount).toBe(12);
    expect(result.pagesCount).toBe(2);
  });

  it('(Success) пустой профиль без постов не должен возращать посты', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'no_posts');

    const dto = new GetPostsQueryParamsDto();
    const query = new GetUserPostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.pagesCount).toBe(0);
  });

  it('(Success) query должен игнорировать черновики (DRAFT)', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_notfound');
    await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED, 'Published');
    await testHelper.createPost(user.id, ['f2'], PostStatus.DRAFT, 'Draft');

    const query = new GetUserPostsQuery(new GetPostsQueryParamsDto(), user.id);
    const result = await handler.execute(query);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Published');
    expect(result.totalCount).toBe(1);
  });

  it('(Success) страница 2 возвращает посты 4-11', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_notfound');
    for (let i = 1; i <= 12; i++) {
      await testHelper.createPost(user.id, [`file-${i}`], PostStatus.PUBLISHED, `Post ${i}`);
    }

    const dto = new GetPostsQueryParamsDto();
    dto.pageNumber = 2;
    dto.pageSize = 8;
    const query = new GetUserPostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.items).toHaveLength(4);
    expect(result.items[0].description).toBe('Post 4');
    expect(result.page).toBe(2);
  });

  it('(Success) должен вернуть посты без переданного query', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'defaults');

    for (let i = 1; i <= 12; i++) {
      await testHelper.createPost(user.id, [`file-${i}`], PostStatus.PUBLISHED, `Post ${i}`);
    }

    const dto = new GetPostsQueryParamsDto();
    const query = new GetUserPostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);
    expect(result.items).toHaveLength(8);
    expect(result.items[0].description).toBe('Post 12');
    expect(result.items[7].description).toBe('Post 5');
  });
});
