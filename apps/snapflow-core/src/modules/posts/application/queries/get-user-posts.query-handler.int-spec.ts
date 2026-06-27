import { PrismaService } from '../../../../database/prisma.service';
import { FilesClient } from '../../../integrations/files/files.client';
import { PostStatus, User } from '@generated/prisma-snapflow';
import { GetUserPostsQuery, GetUserPostsQueryHandler } from './get-user-posts.query-handler';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { GetUserPostsQueryParamsDto } from '../../api/input-dto/get-user-posts.query-params.dto';

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

  it('(Success) первая страница: 12 постов, limit 8 → 8 items, hasMore, nextCursor', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'user-1');

    for (let i = 1; i <= 12; i++) {
      await testHelper.createPost(user.id, [`file-${i}`], PostStatus.PUBLISHED, `Post ${i}`);
    }

    const dto = new GetUserPostsQueryParamsDto();
    dto.limit = 8;

    const result = await handler.execute(new GetUserPostsQuery(dto, user.id));

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
    expect(result.items[0].likesCount).toBe(0);
    expect(result.items[0].isLikedByCurrentUser).toBe(false);
    expect(result.items[0].recentLikers).toEqual([]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
  });

  it('(Success) вторая страница через nextCursor → оставшиеся 4, hasMore: false', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'user-2');

    for (let i = 1; i <= 12; i++) {
      await testHelper.createPost(user.id, [`file-${i}`], PostStatus.PUBLISHED, `Post ${i}`);
    }

    const firstPageDto = new GetUserPostsQueryParamsDto();
    firstPageDto.limit = 8;
    const firstPage = await handler.execute(new GetUserPostsQuery(firstPageDto, user.id));

    const secondPageDto = new GetUserPostsQueryParamsDto();
    secondPageDto.limit = 8;
    secondPageDto.cursor = firstPage.nextCursor!;
    const secondPage = await handler.execute(new GetUserPostsQuery(secondPageDto, user.id));

    expect(secondPage.items).toHaveLength(4);
    expect(secondPage.items[0].description).toBe('Post 4');
    expect(secondPage.items[3].description).toBe('Post 1');
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('(Success) пустой профиль → items: [], hasMore: false, nextCursor: null', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'no_posts');

    const result = await handler.execute(new GetUserPostsQuery(new GetUserPostsQueryParamsDto(), user.id));

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('(Success) query должен игнорировать черновики (DRAFT)', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_notfound');
    await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED, 'Published');
    await testHelper.createPost(user.id, ['f2'], PostStatus.DRAFT, 'Draft');

    const result = await handler.execute(
      new GetUserPostsQuery(new GetUserPostsQueryParamsDto(), user.id),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Published');
  });

  it('(Success) должен вернуть посты с дефолтным limit', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'defaults');

    for (let i = 1; i <= 12; i++) {
      await testHelper.createPost(user.id, [`file-${i}`], PostStatus.PUBLISHED, `Post ${i}`);
    }

    const result = await handler.execute(
      new GetUserPostsQuery(new GetUserPostsQueryParamsDto(), user.id),
    );

    expect(result.items).toHaveLength(8);
    expect(result.items[0].description).toBe('Post 12');
    expect(result.items[7].description).toBe('Post 5');
    expect(result.hasMore).toBe(true);
  });
});
