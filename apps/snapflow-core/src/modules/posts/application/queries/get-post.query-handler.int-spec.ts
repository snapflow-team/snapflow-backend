import { Test, TestingModule } from '@nestjs/testing';
import { GetPostQuery, GetPostQueryHandler } from './get-post.query-handler';
import { PrismaService } from '../../../../database/prisma.service';
import { ValidateFilesResponse } from '../../../../../../../libs/contracts/files';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { CreatePostCommand, CreatePostUseCase } from '../usecases/create-post-use.case';
import { TestEntityFactory } from '../../../../../test/helpers/test-entity.factory';
import { CreatePostInputDto } from '../../api/input-dto/create-post.input-dto';
import { PostVisibility } from '../../enums/post-visibility.enum';
import { PostStatus } from '@generated/prisma-snapflow';

describe('GetPostQueryHandler', () => {
  let module: TestingModule;
  let handler: GetPostQueryHandler;
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
        validateFiles: validateFilesMock, // метод из useCase
      })
      .compile();

    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);
    handler = module.get<GetPostQueryHandler>(GetPostQueryHandler);
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

  it('должен вернуть опубликованный публик тест', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'get_public' });
    const fileIds: string[] = ['11111111-1111-4111-8111-111111111111'];

    const dto: CreatePostInputDto = { description: 'Public post', fileIds };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/jpeg',
        size: 1000,
      })),
    });

    const postId = await useCase.execute(new CreatePostCommand(dto, user.id, PostStatus.PUBLISHED));
    const post = await handler.execute(new GetPostQuery(postId, PostVisibility.Public, user.id));

    expect(post).not.toBeNull();
    expect(post.description).toBe('Public post');
    expect(post.status).toBe(PostStatus.PUBLISHED);
  });

  it('должен вернуть черновик только с Owner visibility и правильным userId', async () => {
    const user = await TestEntityFactory.createTestUser(prisma, { suffix: 'get_draft' });
    const fileIds: string[] = ['22222222-2222-4222-8222-222222222222'];

    const dto: CreatePostInputDto = { description: 'Draft post', fileIds };

    validateFilesMock.mockResolvedValueOnce({
      valid: true,
      files: fileIds.map((fileId) => ({
        fileId,
        url: `https://cdn.test/files/${fileId}`,
        mimeType: 'image/png',
        size: 2000,
      })),
    });

    const postId: number = await useCase.execute(
      new CreatePostCommand(dto, user.id, PostStatus.DRAFT),
    );

    const ownerPost = await handler.execute(
      new GetPostQuery(postId, PostVisibility.Owner, user.id),
    );
    expect(ownerPost.description).toBe('Draft post');

    await expect(
      handler.execute(new GetPostQuery(postId, PostVisibility.Public)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });
  });

  it('должен выбросить BadRequestException при Owner visibility без userId', async () => {
    await expect(handler.execute(new GetPostQuery(1, PostVisibility.Owner))).rejects.toMatchObject({
      code: 'BadRequest',
      message: 'The owner mode requires a userId',
    });
  });

  it('должен выбросить NotFoundException для несуществующего поста', async () => {
    await expect(
      handler.execute(new GetPostQuery(999, PostVisibility.Public)),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });
  });
});
