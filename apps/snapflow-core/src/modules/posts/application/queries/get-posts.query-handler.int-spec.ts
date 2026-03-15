import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GetPostsQuery, GetPostsQueryHandler } from './get-posts.query-handler';
import { CreatePostCommand, CreatePostUseCase } from '../usecases/create-post-use.case';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { PostStatus, User } from '@generated/prisma-snapflow';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';

describe('GetPostQueryHandler (INT)', () => {
  let prisma: PrismaService;
  let module: TestingModule;
  let handler: GetPostsQueryHandler;
  let useCase: CreatePostUseCase;

  let validateFilesMock: jest.Mock<
    Promise<ValidateFilesResponse>,
    [{ userId: number; fileIds: string[] }]
  >;

  beforeAll(async () => {
    validateFilesMock = jest.fn() as unknown as jest.Mock<
      Promise<ValidateFilesResponse>,
      [{ userId: number; fileIds: string[] }]
    >;

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: [{ fileId: 'fl', url: 'test.jpg', mimeType: 'image/jpeg', size: 1000 }],
    });

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
    const users: User[] = await Promise.all([
      TestEntityFactory.createTestUser(prisma, { suffix: 'user-1' }),
      TestEntityFactory.createTestUser(prisma, { suffix: 'user-2' }),
      TestEntityFactory.createTestUser(prisma, { suffix: 'user-3' }),
    ]);

    const postsData = [
      { user: users[0], desc: 'Пост #1 (самый новый)', fileId: 'f1' },
      { user: users[1], desc: 'Пост #2', fileId: 'f2' },
      { user: users[2], desc: 'Пост #3', fileId: 'f3' },
      { user: users[0], desc: 'Пост #4', fileId: 'f4' },
      { user: users[1], desc: 'Пост #5', fileId: 'f5' },
      { user: users[2], desc: 'Пост #6', fileId: 'f6' },
      { user: users[0], desc: 'Пост #7', fileId: 'f7' },
      { user: users[1], desc: 'Пост #8', fileId: 'f8' },
      { user: users[2], desc: 'Пост #9', fileId: 'f9' },
      { user: users[0], desc: 'Пост #10 (самый старый)', fileId: 'f10' },
    ];

    for (const { user, desc, fileId } of postsData) {
      const dto: CreatePostInputDto = { description: desc, fileIds: [fileId] };
      validateFilesMock.mockResolvedValueOnce({
        valid: true,
        files: [{ fileId, url: 'test.jpg', mimeType: 'image/jpeg', size: 1000 }],
      });
      await useCase.execute(new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED));
    }

    const result = await handler.execute(new GetPostsQuery(1, 4));

    expect(result.items).toHaveLength(4);
    expect(result.items[0].description).toBe('Пост #1 (самый новый)'); // главная лента DESC
    expect(result.items[3].description).toBe('Пост #4');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(4);
    expect(result.totalCount).toBe(10);
    expect(result.pagesCount).toBe(3);
  });
});
