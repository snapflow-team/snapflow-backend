import { PrismaService } from '../../../../database/prisma.service';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostStatus, User } from '@generated/prisma-snapflow';
import { EditPostCommand, EditPostUseCase } from './edit-post.use.case';
import { UpdatePostInputDto } from '../../api/input-dto/update-post.input.dto';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';

describe('EditPostUseCase (Интеграционные тесты)', () => {
  let prisma: PrismaService;
  let testHelper: IntTestHelper;
  let useCase: EditPostUseCase;

  const validateFilesMock = jest.fn();

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule([
      {
        provide: FilesClient,
        useValue: { validateFiles: validateFilesMock },
      },
    ]);

    useCase = testHelper.get<EditPostUseCase>(EditPostUseCase);
    prisma = testHelper.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
    validateFilesMock.mockClear();
    validateFilesMock.mockReset();
  });

  it('(Success) должен обновить пост', async () => {
    const user = await testHelper.createUserWithProfile(prisma, 'post_draft');

    const postId = await testHelper.createPost(
      user.id,
      ['f1'],
      PostStatus.DRAFT,
      'Original description',
    );

    const updateDto: UpdatePostInputDto = {
      description: 'Updated description',
    };
    await useCase.execute(
      new EditPostCommand({
        userId: user.id,
        postId,
        description: updateDto.description,
      }),
    );

    const updatedPost = await prisma.post.findFirst({
      where: { id: postId },
    });
    expect(updatedPost).not.toBeNull();
    expect(updatedPost!.description).toBe('Updated description');
  });

  it('(NotFound) должен выбросить NotFoundException если пост не найден', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_notfound');

    const updateDto: UpdatePostInputDto = { description: 'test' };
    const incorrectPostId = 0;
    await expect(
      useCase.execute(
        new EditPostCommand({
          userId: user.id,
          postId: incorrectPostId,
          description: updateDto.description,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
  it('(NotFound) должен выбросить NotFoundException если пост для другого юзера', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'post_notfound');
    const postId = await testHelper.createPost(
      user.id,
      ['f1'],
      PostStatus.DRAFT,
      'Original description',
    );

    const updateDto: UpdatePostInputDto = { description: 'test' };
    const incorrectUserId = 0;
    await expect(
      useCase.execute(
        new EditPostCommand({
          userId: incorrectUserId,
          postId: postId,
          description: updateDto.description,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(1);
  });
});
