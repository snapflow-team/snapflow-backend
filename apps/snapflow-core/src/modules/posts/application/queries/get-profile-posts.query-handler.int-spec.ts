import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { CreatePostUseCase } from '../usecases/create-post-use.case';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { PostStatus } from '@generated/prisma-snapflow';
import {
  GetProfilePostsQuery,
  GetProfilePostsQueryHandler,
} from './get-profile-posts.query-handler';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { GetPostsQueryParamsDto, PostSortBy } from '../../api/input-dto/get-posts.query-params.dto';

describe('GetProfilePostsQueryHandler', () => {
  let module: TestingModule;
  let handler: GetProfilePostsQueryHandler;
  let prisma: PrismaService;
  let useCase: CreatePostUseCase;
  let helper: IntTestHelper;

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
    handler = module.get<GetProfilePostsQueryHandler>(GetProfilePostsQueryHandler);
    helper = new IntTestHelper(validateFilesMock, useCase);
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

  it('должен вернуть опубликованные посты профиля (DESC)', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-1' });

    for (let i = 0; i < 12; i++) {
      await helper.createPost(user.id, `Post ${i + 1}`, `file-${i + 1}`, PostStatus.PUBLISHED);
    }

    const dto = new GetPostsQueryParamsDto();
    dto.pageNumber = 1;
    dto.pageSize = 8;
    dto.sortBy = PostSortBy.createdAt;

    const query = new GetProfilePostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.items).toHaveLength(8);
    expect(result.items[0].description).toBe('Post 12');
    expect(result.items[7].description).toBe('Post 5');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);
    expect(result.totalCount).toBe(12);
    expect(result.pagesCount).toBe(2);
  });

  it('пустой профиль', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'no_posts' });

    const dto = new GetPostsQueryParamsDto();
    const query = new GetProfilePostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.pagesCount).toBe(0);
  });

  it('игнорирует черновики (DRAFT)', async () => {
    const user = await TestEntityFactory.createTestUser(prisma);
    await helper.createPost(user.id, 'Published', 'file1', PostStatus.PUBLISHED);
    await helper.createPost(user.id, 'Draft', 'file2', PostStatus.DRAFT);

    const query = new GetProfilePostsQuery(new GetPostsQueryParamsDto(), user.id);
    const result = await handler.execute(query);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Published');
    expect(result.totalCount).toBe(1);
  });

  it('страница 2 возвращает посты 4-11', async () => {
    const user = await TestEntityFactory.createTestUser(prisma);
    for (let i = 0; i < 12; i++) {
      await helper.createPost(user.id, `Post ${i + 1}`, `file-${i + 1}`);
    }

    const dto = new GetPostsQueryParamsDto();
    dto.pageNumber = 2;
    dto.pageSize = 8;
    const query = new GetProfilePostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.items).toHaveLength(4);
    expect(result.items[0].description).toBe('Post 4');
    expect(result.page).toBe(2);
  });

  it('должен вернуть без params', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'defaults' });

    for (let i = 1; i <= 12; i++) {
      await helper.createPost(user.id, `Post ${i}`, `file-${i}`, PostStatus.PUBLISHED);
    }

    const dto = new GetPostsQueryParamsDto();
    const query = new GetProfilePostsQuery(dto, user.id);

    const result = await handler.execute(query);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);
    expect(result.items).toHaveLength(8);
    expect(result.items[0].description).toBe('Post 12');
    expect(result.items[7].description).toBe('Post 5');
  });
});
