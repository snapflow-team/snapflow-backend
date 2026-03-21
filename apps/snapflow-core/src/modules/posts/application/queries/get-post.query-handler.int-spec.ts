import { Test, TestingModule } from '@nestjs/testing';
import { GetPostQuery, GetPostQueryHandler } from './get-post.query-handler';
import { PrismaService } from '../../../../database/prisma.service';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { CreatePostUseCase } from '../usecases/create-post-use.case';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { PostStatus } from '@generated/prisma-snapflow';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { ProfilesRepository } from '../../../user-accounts/users/profile/infrastructure/profiles.repository';

describe('GetPostQueryHandler', () => {
  let module: TestingModule;
  let handler: GetPostQueryHandler;
  let repo: ProfilesRepository;
  let prisma: PrismaService;
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

    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);
    handler = module.get<GetPostQueryHandler>(GetPostQueryHandler);
    repo = module.get<ProfilesRepository>(ProfilesRepository);
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
    await prisma.userProfile.deleteMany();
    validateFilesMock.mockClear();
  });

  it('должен вернуть опубликованный публик тест', async () => {
    const user = await intTestHelper.createUserWithProfile(prisma, 'get_public');
    const postId = await intTestHelper.createPost(
      user.id,
      ['f'],
      PostStatus.PUBLISHED,
      'Public post',
    );

    const post = await handler.execute(new GetPostQuery(postId, user.id));

    expect(post).not.toBeNull();
    expect(post.description).toBe('Public post');
    expect(post.status).toBe(PostStatus.PUBLISHED);
  });

  it('должен вернуть черновик только с Owner visibility и правильным userId', async () => {
    const user = await intTestHelper.createUserWithProfile(prisma, 'get_draft');

    const postId = await intTestHelper.createPost(user.id, ['f2'], PostStatus.DRAFT, 'Draft post');

    const post = await handler.execute(new GetPostQuery(postId, user.id));

    expect(post).not.toBeNull();
    expect(post.description).toBe('Draft post');
    expect(post.status).toBe(PostStatus.DRAFT);

    await expect(handler.execute(new GetPostQuery(postId, 999))).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });
  });

  it('должен выбросить NotFoundException для несуществующего поста', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'get_draft' });

    await expect(handler.execute(new GetPostQuery(999, user.id))).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });
  });
});
