import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { CreatePostCommand, CreatePostUseCase } from '../usecases/create-post-use.case';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { PostStatus } from '@generated/prisma-snapflow';
import {
  GetProfilePostsQuery,
  GetProfilePostsQueryHandler,
} from './get-profile-posts.query-handler';

describe('GetProfilePostsQueryHandler', () => {
  let module: TestingModule;
  let handler: GetProfilePostsQueryHandler;
  let prisma: PrismaService;
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

    validateFilesMock.mockResolvedValue({
      valid: true,
      files: [{ fileId: 'f1', url: 'test.jpg', mimeType: 'image/jpeg', size: 1000 }],
    });

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

  it('должен вернуть опубликованный публик потс', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'get_public' });
    for (let i = 0; i < 12; i++) {
      const dto: CreatePostInputDto = {
        description: `Post ${i + 1}`,
        fileIds: [`file-${i + 1}`],
      };
      validateFilesMock.mockResolvedValueOnce({
        valid: true,
        files: [{ fileId: dto.fileIds[0], url: 'test.jpg', mimeType: 'image/jpeg', size: 1000 }],
      });

      await useCase.execute(new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED));
    }
    const result = await handler.execute(new GetProfilePostsQuery(user.id, 1, 8));

    expect(result.items).toHaveLength(8);
    expect(result.items[0].description).toBe('Post 12');
    expect(result.items[7].description).toBe('Post 5');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(8);
    expect(result.totalCount).toBe(12);
    expect(result.pagesCount).toBe(2);
  });

  it('должен вернуть пустой результат для пользователя без постов', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'no_posts' });

    const result = await handler.execute(new GetProfilePostsQuery(user.id, 1, 8));

    expect(result.items).toHaveLength(0);
    expect(result.totalCount).toBe(0);
    expect(result.pagesCount).toBe(0);
  });
});
