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

describe('PostCommentsController - getPostComments() (GET: /posts/:postId/comments)', () => {
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
    postId: number;
  }> {
    const [author] = await authTestManager.registrationWithConfirmation([], 1);

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    return { author, postId: post.id };
  }

  it('должен вернуть пустой список, если у поста нет комментариев', async () => {
    const { postId } = await createAuthorWithPublishedPost();

    const page = await commentTestManager.getPostCommentsBody(postId);

    expect(page).toEqual<PostCommentsPageViewDto>({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it('должен возвращать только корневые комментарии и repliesCount для ответов', async () => {
    const users = await authTestManager.registrationWithConfirmation([], 1);
    const [author] = users;
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Root comment',
    });

    await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Reply',
      parentId: parent.id,
    });

    const page = await commentTestManager.getPostCommentsBody(post.id);

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: parent.id,
      text: 'Root comment',
      parentId: null,
      repliesCount: 1,
    });
  });

  it('должен сортировать комментарии от новых к старым', async () => {
    const users = await authTestManager.registrationWithConfirmation([], 3);
    const [author, userA, userB] = users;

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const baseDate = new Date('2026-02-01T10:00:00.000Z');

    const older = await commentTestManager.seedRootComment({
      postId: post.id,
      userId: userA.id,
      text: 'older',
      createdAt: new Date(baseDate.getTime()),
    });
    const newer = await commentTestManager.seedRootComment({
      postId: post.id,
      userId: userB.id,
      text: 'newer',
      createdAt: new Date(baseDate.getTime() + 60_000),
    });

    const page = await commentTestManager.getPostCommentsBody(post.id);

    expect(page.items.map((item) => item.id)).toEqual([newer.id.toString(), older.id.toString()]);
  });

  it('должен вернуть следующую страницу по nextCursor без дубликатов', async () => {
    const { author, postId } = await createAuthorWithPublishedPost();
    const baseDate = new Date('2026-03-01T08:00:00.000Z');

    for (let i = 0; i < 10; i++) {
      await commentTestManager.seedRootComment({
        postId,
        userId: author.id,
        text: `comment-${i}`,
        createdAt: new Date(baseDate.getTime() + i * 60_000),
      });
    }

    const page1 = await commentTestManager.getPostCommentsBody(postId, { limit: 8 });

    expect(page1.items).toHaveLength(8);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await commentTestManager.getPostCommentsBody(postId, {
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

  it('должен вернуть 400 BAD_REQUEST при невалидном cursor', async () => {
    const { postId } = await createAuthorWithPublishedPost();

    const res: Response = await commentTestManager.getPostComments(
      postId,
      { cursor: 'not-a-valid-cursor' },
      undefined,
      HttpStatus.BAD_REQUEST,
    );

    expect(res.body).toEqual({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments?cursor=not-a-valid-cursor`,
      method: 'GET',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [{ field: 'cursor', message: 'Invalid cursor' }],
    });
  });

  it('не должен возвращать soft-deleted комментарии', async () => {
    const users = await authTestManager.registrationWithConfirmation([], 1);
    const [author] = users;

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const visible = await commentTestManager.seedRootComment({
      postId: post.id,
      userId: author.id,
      text: 'visible',
    });
    const deleted = await commentTestManager.seedRootComment({
      postId: post.id,
      userId: author.id,
      text: 'deleted',
    });

    await commentTestManager.softDelete(deleted.id);

    const page = await commentTestManager.getPostCommentsBody(post.id);

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe(visible.id.toString());
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего поста', async () => {
    const nonExistentPostId = 999999;

    const res: Response = await commentTestManager.getPostComments(
      nonExistentPostId,
      {},
      undefined,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${nonExistentPostId}/comments`,
      method: 'GET',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });
});
