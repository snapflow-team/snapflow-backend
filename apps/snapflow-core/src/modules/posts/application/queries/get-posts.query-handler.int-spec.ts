import { PrismaService } from '../../../../database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GetPostsQuery, GetPostsQueryHandler } from './get-posts.query-handler';
import { CreatePostCommand, CreatePostUseCase } from '../usecases/create-post-use.case';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { PostStatus } from '@generated/prisma-snapflow';

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

  const mockFileValidation = (fileId: string) => {
    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: [
        {
          fileId,
          url: 'test.jpg',
          mimeType: 'image/jpeg',
          size: 1000,
        },
      ],
    });
  };

  const createPublishedPost = async (userId: number, description: string, fileId: string) => {
    mockFileValidation(fileId);

    await useCase.execute(
      new CreatePostCommand(
        {
          description,
          fileIds: [fileId],
        },
        userId,
        PostStatus.PUBLISHED,
      ),
    );
  };

  it('должен вернуть 4 последних публик поста', async () => {
    const user1 = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-1' });
    const user2 = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-2' });
    const user3 = await TestEntityFactory.createTestUser(prisma, { suffix: 'user-3' });

    await createPublishedPost(user1.id, 'Пост #10 (самый старый)', 'f10');
    await createPublishedPost(user2.id, 'Пост #9', 'f9');
    await createPublishedPost(user3.id, 'Пост #8', 'f8');
    await createPublishedPost(user1.id, 'Пост #7', 'f7');
    await createPublishedPost(user2.id, 'Пост #6', 'f6');
    await createPublishedPost(user3.id, 'Пост #5', 'f5');
    await createPublishedPost(user1.id, 'Пост #4', 'f4');
    await createPublishedPost(user2.id, 'Пост #3', 'f3');
    await createPublishedPost(user3.id, 'Пост #2', 'f2');
    await createPublishedPost(user1.id, 'Пост #1 (самый новый)', 'f1');

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
});
