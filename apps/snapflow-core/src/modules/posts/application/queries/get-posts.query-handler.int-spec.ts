import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GetPostsQuery, GetPostsQueryHandler } from './get-posts.query-handler';
import { CreatePostUseCase } from '../usecases/create-post-use.case';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { PostStatus } from '@generated/prisma-snapflow';
import { GetPostsQueryParamsDto } from '../../api/input-dto/get-posts.query-params.dto';
import { ProfilesRepository } from '../../../user-accounts/users/profile/infrastructure/profiles.repository';

describe('GetPostQueryHandler (INT)', () => {
  let prisma: PrismaService;
  let module: TestingModule;
  let handler: GetPostsQueryHandler;
  let repo: ProfilesRepository;
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
    repo = module.get<ProfilesRepository>(ProfilesRepository);
    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);
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
    await prisma.user.deleteMany({});
    validateFilesMock.mockClear();
  });

  it('должен вернуть 4 последних публик поста', async () => {
    const user1 = await intTestHelper.createUserWithProfile(prisma, 'user-1');
    const user2 = await intTestHelper.createUserWithProfile(prisma, 'user-2');
    const user3 = await intTestHelper.createUserWithProfile(prisma, 'user-3');

    await intTestHelper.createPost(user1.id, ['f10'], undefined, 'Пост #10 (самый старый)');
    await intTestHelper.createPost(user2.id, ['f9'], undefined, 'Пост #9');
    await intTestHelper.createPost(user3.id, ['f8'], undefined, 'Пост #8');
    await intTestHelper.createPost(user1.id, ['f7'], undefined, 'Пост #7');
    await intTestHelper.createPost(user2.id, ['f6'], undefined, 'Пост #6');
    await intTestHelper.createPost(user3.id, ['f5'], undefined, 'Пост #5');
    await intTestHelper.createPost(user1.id, ['f4'], undefined, 'Пост #4');
    await intTestHelper.createPost(user2.id, ['f3'], undefined, 'Пост #3');
    await intTestHelper.createPost(user3.id, ['f2'], undefined, 'Пост #2');
    await intTestHelper.createPost(user1.id, ['f1'], undefined, 'Пост #1 (самый новый)');

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
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
    expect(result.totalCount).toBe(10);
    expect(result.pagesCount).toBe(3);
  });

  it('должен вернуть пустой список, если обупликованных постов нет', async () => {
    const dto = new GetPostsQueryParamsDto();

    dto.pageSize = 4;
    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.pagesCount).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
  });

  it('должен возвращать только публик посты', async () => {
    const user = await intTestHelper.createUserWithProfile(prisma, 'drafts');

    await intTestHelper.createPost(user.id, ['f1'], PostStatus.DRAFT, 'DraftPost');
    await intTestHelper.createPost(user.id, ['f2'], PostStatus.PUBLISHED, 'PublicPost');

    const dto = new GetPostsQueryParamsDto();

    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('PublicPost');
    expect(result.totalCount).toBe(1);
  });

  it('должен игнорировать удалённые посты', async () => {
    const user = await intTestHelper.createUserWithProfile(prisma, 'deleted');

    await intTestHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED, 'Видимый пост');

    const dto = new GetPostsQueryParamsDto();

    const result = await handler.execute(new GetPostsQuery(dto));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Видимый пост');
    expect(result.totalCount).toBe(1);
  });
});
