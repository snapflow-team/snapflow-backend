import { PrismaService } from '../../../../../database/prisma.service';
import { IntTestHelper } from '../../../../../../test/helpers/int.test.helper';
import { Comment, PostStatus, User } from '@generated/prisma-snapflow';
import { CreateCommentCommand, CreateCommentUseCase } from './create-comment.usecase';

describe('CreateCommentUseCase', () => {
  let prisma: PrismaService;
  let useCase: CreateCommentUseCase;
  let testHelper: IntTestHelper;

  beforeAll(async () => {
    testHelper = new IntTestHelper();
    await testHelper.createTestingModule();
    prisma = testHelper.get<PrismaService>(PrismaService);
    useCase = testHelper.get<CreateCommentUseCase>(CreateCommentUseCase);
  });

  afterAll(async () => {
    await testHelper.close();
  });

  beforeEach(async () => {
    await testHelper.cleanupDb();
  });

  const execute = (userId: number, postId: number, text: string, parentId: number | null = null) =>
    useCase.execute(
      new CreateCommentCommand({
        userId,
        postId,
        text,
        parentId,
      }),
    );

  it('(Success) должен создать комментарий к опубликованному посту', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'comment_ok');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED);

    const commentId: number = await execute(user.id, postId, 'Great post!');

    const comment: Comment | null = await prisma.comment.findUnique({ where: { id: commentId } });
    expect(comment).toMatchObject({
      text: 'Great post!',
      postId,
      userId: user.id,
      parentId: null,
      deletedAt: null,
    });
  });

  it('(Success) должен создать ответ на комментарий', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'reply_ok');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED);
    const parentId: number = await execute(user.id, postId, 'Parent comment');

    const replyId: number = await execute(user.id, postId, 'Reply text', parentId);

    const reply: Comment | null = await prisma.comment.findUnique({ where: { id: replyId } });
    expect(reply).toMatchObject({
      text: 'Reply text',
      postId,
      userId: user.id,
      parentId,
      deletedAt: null,
    });
  });

  it('(NotFound) должен выбросить ошибку если пост не существует', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'no_post');

    await expect(execute(user.id, 0, 'Comment')).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });
  });

  it('(NotFound) должен выбросить ошибку для черновика поста', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'draft_post');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.DRAFT);

    await expect(execute(user.id, postId, 'Comment')).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });
  });

  it('(NotFound) должен выбросить ошибку для удалённого поста', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'deleted_post');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED);

    await prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    await expect(execute(user.id, postId, 'Comment')).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Post not found',
    });
  });

  it('(NotFound) должен выбросить ошибку при невалидном parentId', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'bad_parent');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED);

    await expect(execute(user.id, postId, 'Reply', 0)).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Parent comment not found',
    });
  });

  it('(NotFound) должен выбросить ошибку если parentId из другого поста', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'cross_post');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED);
    const otherPostId: number = await testHelper.createPost(user.id, ['f2'], PostStatus.PUBLISHED);
    const parentId: number = await execute(user.id, otherPostId, 'Other post comment');

    await expect(execute(user.id, postId, 'Reply', parentId)).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Parent comment not found',
    });
  });

  it('(NotFound) должен выбросить ошибку если родительский комментарий удалён', async () => {
    const user: User = await testHelper.createUserWithProfile(prisma, 'deleted_parent');
    const postId: number = await testHelper.createPost(user.id, ['f1'], PostStatus.PUBLISHED);
    const parentId: number = await execute(user.id, postId, 'Parent');

    await prisma.comment.update({
      where: { id: parentId },
      data: { deletedAt: new Date() },
    });

    await expect(execute(user.id, postId, 'Reply', parentId)).rejects.toMatchObject({
      code: 'NotFound',
      message: 'Parent comment not found',
    });
  });
});
