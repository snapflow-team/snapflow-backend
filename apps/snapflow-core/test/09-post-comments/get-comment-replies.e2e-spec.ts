import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { PostCommentsPageViewDto } from '../../src/modules/posts/comments/api/view-dto/post-comments-page.view-dto';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { CommentTestManager } from '../managers/comment.test-manager';
import { PostTestManager } from '../managers/post.test-manager';

const DEFAULT_PASSWORD = 'Qwerty_1';

describe('PostCommentsController - getCommentReplies() (GET: /posts/:postId/comments/:commentId/replies)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let postTestManager: PostTestManager;
  let commentTestManager: CommentTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    postTestManager = new PostTestManager(appTestManager.prisma);
    commentTestManager = new CommentTestManager(appTestManager.prisma, server);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();

    sendEmailMock.mockClear();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  async function loginUser(email: string): Promise<string> {
    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({ email, password: DEFAULT_PASSWORD })
      .expect(HttpStatus.OK);

    const accessToken = (res.body as { accessToken: string }).accessToken;

    if (!accessToken) {
      throw new Error(`loginUser(): accessToken not found for email "${email}"`);
    }

    return accessToken;
  }

  async function createAuthorWithPublishedPost(): Promise<{
    author: UserWithEmailConfirmation;
    authorAccessToken: string;
    postId: number;
  }> {
    const [author] = await authTestManager.registrationWithConfirmation([], 1);
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    return { author, authorAccessToken, postId: post.id };
  }

  it('должен вернуть пустой список, если у комментария нет ответов', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Root comment',
    });

    const page = await commentTestManager.getCommentRepliesBody(postId, Number(parent.id));

    expect(page).toEqual<PostCommentsPageViewDto>({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('должен возвращать только ответы заданного комментария', async () => {
    const users = await authTestManager.registrationWithConfirmation([], 1);
    const [author] = users;
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const parentA = await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Parent A',
    });
    const parentB = await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Parent B',
    });

    const replyA = await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Reply to A',
      parentId: parentA.id,
    });
    await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Reply to B',
      parentId: parentB.id,
    });

    const page = await commentTestManager.getCommentRepliesBody(post.id, Number(parentA.id));

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: replyA.id,
      text: 'Reply to A',
      parentId: parentA.id,
    });
  });

  it('должен вернуть следующую страницу по nextCursor без дубликатов', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Parent',
    });

    const baseDate = new Date('2026-04-01T08:00:00.000Z');

    for (let i = 0; i < 10; i++) {
      await commentTestManager.seedReply({
        postId,
        userId: author.id,
        parentId: Number(parent.id),
        text: `reply-${i}`,
        createdAt: new Date(baseDate.getTime() + i * 60_000),
      });
    }

    const page1 = await commentTestManager.getCommentRepliesBody(postId, Number(parent.id), {
      limit: 8,
    });

    expect(page1.items).toHaveLength(8);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await commentTestManager.getCommentRepliesBody(postId, Number(parent.id), {
      cursor: page1.nextCursor!,
      limit: 8,
    });

    expect(page2.items).toHaveLength(2);
    expect(page2.hasMore).toBe(false);
    expect(page2.nextCursor).toBeNull();

    const page1Ids = page1.items.map((item) => item.id);
    const page2Ids = page2.items.map((item) => item.id);
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
  });

  it('не должен возвращать soft-deleted ответы', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Parent',
    });

    const visible = await commentTestManager.seedReply({
      postId,
      userId: author.id,
      parentId: Number(parent.id),
      text: 'visible reply',
    });
    const deleted = await commentTestManager.seedReply({
      postId,
      userId: author.id,
      parentId: Number(parent.id),
      text: 'deleted reply',
    });

    await commentTestManager.softDelete(deleted.id);

    const page = await commentTestManager.getCommentRepliesBody(postId, Number(parent.id));

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe(visible.id.toString());
  });

  it('должен вернуть 400 BAD_REQUEST при невалидном cursor', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Parent',
    });

    const res: Response = await commentTestManager.getCommentReplies(
      postId,
      Number(parent.id),
      { cursor: 'not-a-valid-cursor' },
      undefined,
      HttpStatus.BAD_REQUEST,
    );

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments/${parent.id}/replies?cursor=not-a-valid-cursor`,
      method: 'GET',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [{ field: 'cursor', message: 'Invalid cursor' }],
    });
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего поста', async () => {
    const nonExistentPostId = 999999;
    const nonExistentCommentId = 888888;

    const res: Response = await commentTestManager.getCommentReplies(
      nonExistentPostId,
      nonExistentCommentId,
      {},
      undefined,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${nonExistentPostId}/comments/${nonExistentCommentId}/replies`,
      method: 'GET',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего комментария', async () => {
    const { postId } = await createAuthorWithPublishedPost();
    const nonExistentCommentId = 999999;

    const res: Response = await commentTestManager.getCommentReplies(
      postId,
      nonExistentCommentId,
      {},
      undefined,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments/${nonExistentCommentId}/replies`,
      method: 'GET',
      message: 'Comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND если комментарий не принадлежит посту', async () => {
    const users = await authTestManager.registrationWithConfirmation([], 1);
    const [author] = users;
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 2);

    const [post, otherPost] = await appTestManager.prisma.post.findMany({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
      orderBy: { id: 'asc' },
    });

    const commentOnOtherPost = await commentTestManager.createAndGetBody(
      authorAccessToken,
      otherPost.id,
      { text: 'Comment on other post' },
    );

    const res: Response = await commentTestManager.getCommentReplies(
      post.id,
      Number(commentOnOtherPost.id),
      {},
      undefined,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${post.id}/comments/${commentOnOtherPost.id}/replies`,
      method: 'GET',
      message: 'Comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND если родительский комментарий soft-deleted', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Parent',
    });

    await commentTestManager.softDelete(Number(parent.id));

    const res: Response = await commentTestManager.getCommentReplies(
      postId,
      Number(parent.id),
      {},
      undefined,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments/${parent.id}/replies`,
      method: 'GET',
      message: 'Comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });
});
