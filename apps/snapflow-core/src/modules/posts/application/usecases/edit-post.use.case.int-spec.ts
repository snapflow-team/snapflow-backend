import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../database/prisma.service';
import { CreatePostUseCase } from './create-post-use.case';
import { SnapflowCoreModule } from '../../../../snapflow-core.module';
import { FilesClient } from '../../../integrations/files/files.client';
import { Post, PostStatus, User } from '@generated/prisma-snapflow';
import { EditPostCommand, EditPostUseCase } from './edit-post.use.case';
import { UpdatePostInputDto } from '../../api/input-dto/update-post.input.dto';
import { IntTestHelper } from '../../../../../test/helpers/int.test.helper';
import { ProfilesRepository } from '../../../user-accounts/users/profile/infrastructure/profiles.repository';

describe('EditPostUseCase (Int)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let editPostUseCase: EditPostUseCase;
  let createPostUseCase: CreatePostUseCase;
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

    editPostUseCase = module.get<EditPostUseCase>(EditPostUseCase);
    createPostUseCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    const profilesRepo = module.get<ProfilesRepository>(ProfilesRepository);
    intTestHelper = new IntTestHelper(validateFilesMock, createPostUseCase, profilesRepo);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    await prisma.postMedia.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.userProfile.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.userProfile.deleteMany({});
    validateFilesMock.mockClear();
  });

  it('должен обновить пост', async () => {
    const user = await intTestHelper.createUserWithProfile(prisma, 'post_draft');

    const postId = await intTestHelper.createPost(
      user.id,
      ['f1'],
      PostStatus.DRAFT,
      'Original description',
    );

    const updateDto: UpdatePostInputDto = {
      description: 'Updated description',
    };
    await editPostUseCase.execute(
      new EditPostCommand({ userId: user.id, postId, description: updateDto.description }),
    );

    const updatedPost = await prisma.post.findFirst({ where: { id: postId } });
    expect(updatedPost).not.toBeNull();
    expect(updatedPost!.description).toBe('Updated description');
  });

  it('должен выбросить NotFoundException если пост не найден или чужой', async () => {
    const user: User = await intTestHelper.createUserWithProfile(prisma, 'post_notfound');

    const updateDto: UpdatePostInputDto = { description: 'test' };
    await expect(
      editPostUseCase.execute(
        new EditPostCommand({ userId: user.id, postId: 999, description: updateDto.description }),
      ),
    ).rejects.toMatchObject({
      code: 'NotFound',
      message: 'The post was not found',
    });

    const posts: Post[] = await prisma.post.findMany();
    expect(posts).toHaveLength(0);
  });
});
