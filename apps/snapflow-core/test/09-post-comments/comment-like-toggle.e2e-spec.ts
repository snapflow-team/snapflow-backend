import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { CommentTestManager } from '../managers/comment.test-manager';
import { PostTestManager } from '../managers/post.test-manager';

const DEFAULT_PASSWORD = 'Qwerty_1';

describe('PostCommentsController - toggleCommentLike() (POST: /posts/:postId/comments/:commentId/like)', () => {
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

  async function createAuthorWithPublishedPostAndComment(): Promise<{
    author: UserWithEmailConfirmation;
    authorAccessToken: string;
    postId: number;
    commentId: number;
  }> {
    const [author] = await authTestManager.registrationWithConfirmation([], 1);
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const comment = await commentTestManager.createAndGetBody(authorAccessToken, post.id, {
      text: 'Root comment',
    });

    return {
      author,
      authorAccessToken,
      postId: post.id,
      commentId: Number(comment.id),
    };
  }

  it('должен поставить лайк (204) и вернуть likesCount=1, isLikedByCurrentUser=true', async () => {
    const { author, authorAccessToken, postId, commentId } =
      await createAuthorWithPublishedPostAndComment();

    await commentTestManager.toggleLike(authorAccessToken, postId, commentId);

    const comment = await commentTestManager.getCommentFromPostComments(
      postId,
      commentId,
      authorAccessToken,
    );

    expect(comment.likesCount).toBe(1);
    expect(comment.isLikedByCurrentUser).toBe(true);
    expect(await commentTestManager.isActiveLike(commentId, author.id)).toBe(true);
  });

  it('должен убрать лайк при повторном toggle (204) и вернуть likesCount=0, isLikedByCurrentUser=false', async () => {
    const { author, authorAccessToken, postId, commentId } =
      await createAuthorWithPublishedPostAndComment();

    await commentTestManager.toggleLike(authorAccessToken, postId, commentId);
    await commentTestManager.toggleLike(authorAccessToken, postId, commentId);

    const comment = await commentTestManager.getCommentFromPostComments(
      postId,
      commentId,
      authorAccessToken,
    );

    expect(comment.likesCount).toBe(0);
    expect(comment.isLikedByCurrentUser).toBe(false);

    const likeRecord = await commentTestManager.findLikeRecord(commentId, author.id);
    expect(likeRecord).not.toBeNull();
    expect(likeRecord!.deletedAt).not.toBeNull();
    expect(await commentTestManager.isActiveLike(commentId, author.id)).toBe(false);
  });

  it('должен вернуть isLikedByCurrentUser=false для гостя на GET /posts/:postId/comments', async () => {
    const { author, authorAccessToken, postId, commentId } =
      await createAuthorWithPublishedPostAndComment();

    await commentTestManager.toggleLike(authorAccessToken, postId, commentId);

    const comment = await commentTestManager.getCommentFromPostComments(postId, commentId);

    expect(comment.likesCount).toBe(1);
    expect(comment.isLikedByCurrentUser).toBe(false);
  });

  it('должен вернуть 401 UNAUTHORIZED при toggle без JWT', async () => {
    const { postId, commentId } = await createAuthorWithPublishedPostAndComment();

    await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${postId}/comments/${commentId}/like`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего комментария', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPostAndComment();
    const nonExistentCommentId = 999999;

    const res: Response = await commentTestManager.toggleLike(
      authorAccessToken,
      postId,
      nonExistentCommentId,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments/${nonExistentCommentId}/like`,
      method: 'POST',
      message: 'Comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего поста', async () => {
    const { authorAccessToken } = await createAuthorWithPublishedPostAndComment();
    const nonExistentPostId = 999999;
    const nonExistentCommentId = 999999;

    const res: Response = await commentTestManager.toggleLike(
      authorAccessToken,
      nonExistentPostId,
      nonExistentCommentId,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${nonExistentPostId}/comments/${nonExistentCommentId}/like`,
      method: 'POST',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND для soft-deleted комментария', async () => {
    const { authorAccessToken, postId, commentId } =
      await createAuthorWithPublishedPostAndComment();

    await commentTestManager.softDelete(commentId);

    const res: Response = await commentTestManager.toggleLike(
      authorAccessToken,
      postId,
      commentId,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments/${commentId}/like`,
      method: 'POST',
      message: 'Comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND для неопубликованного (DRAFT) поста', async () => {
    const {
      createdUser: { id: userId },
      accessToken,
    } = await authTestManager.loginAndGetAuthTokens();

    await postTestManager.createDraftPost(userId, [], 1);

    const draftPost = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId, status: 'DRAFT', deletedAt: null },
    });

    const comment = await commentTestManager.seedRootComment({
      postId: draftPost.id,
      userId,
      text: 'Draft post comment',
    });

    const res: Response = await commentTestManager.toggleLike(
      accessToken,
      draftPost.id,
      comment.id,
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${draftPost.id}/comments/${comment.id}/like`,
      method: 'POST',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });
});
