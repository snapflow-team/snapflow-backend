import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { commentTextConstraints } from '../../src/modules/posts/comments/api/input-dto/create-comment.input-dto';
import { CommentItemViewDto } from '../../src/modules/posts/comments/api/view-dto/comment-item.view-dto';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { CommentTestManager } from '../managers/comment.test-manager';
import { PostTestManager } from '../managers/post.test-manager';

const DEFAULT_PASSWORD = 'Qwerty_1';

describe('PostCommentsController - createComment() (POST: /posts/:postId/comments)', () => {
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

  it('должен создать комментарий и вернуть CommentItemViewDto', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const comment: CommentItemViewDto = await commentTestManager.createAndGetBody(
      authorAccessToken,
      postId,
      { text: 'Great post!' },
    );

    expect(comment).toEqual<CommentItemViewDto>({
      id: expect.any(String),
      text: 'Great post!',
      createdAt: expect.any(String),
      author: {
        userId: author.id.toString(),
        username: author.username,
        avatarUrl: null,
      },
      parentId: null,
      repliesCount: 0,
    });

    const dbComment = await appTestManager.prisma.comment.findFirstOrThrow({
      where: { postId, userId: author.id },
    });
    expect(dbComment.deletedAt).toBeNull();
    expect(dbComment.parentId).toBeNull();
  });

  it('должен принять text длиной 1 и 300 символов', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const minText = 'a';
    const maxText = 'x'.repeat(commentTextConstraints.maxLength);

    const minComment = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: minText,
    });
    const maxComment = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: maxText,
    });

    expect(minComment.text).toBe(minText);
    expect(maxComment.text).toBe(maxText);
  });

  it('должен вернуть 400 BAD_REQUEST при пустом text', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      postId,
      { text: '' },
      HttpStatus.BAD_REQUEST,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments`,
      method: 'POST',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'text',
          message: `Length must be between ${commentTextConstraints.minLength} and ${commentTextConstraints.maxLength} characters`,
        },
      ],
    });
  });

  it('должен вернуть 400 BAD_REQUEST при text длиннее 300 символов', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      postId,
      { text: 'x'.repeat(commentTextConstraints.maxLength + 1) },
      HttpStatus.BAD_REQUEST,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments`,
      method: 'POST',
      message: 'Validation failed',
      code: SnapFlowDomainExceptionCode.ValidationError,
      extensions: [
        {
          field: 'text',
          message: `Length must be between ${commentTextConstraints.minLength} and ${commentTextConstraints.maxLength} characters`,
        },
      ],
    });
  });

  it('должен создать ответ на комментарий с parentId', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Parent comment',
    });

    const reply = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Reply text',
      parentId: parent.id,
    });

    expect(reply).toMatchObject({
      text: 'Reply text',
      parentId: parent.id,
      author: {
        userId: author.id.toString(),
        username: author.username,
        avatarUrl: null,
      },
    });

    const dbReply = await appTestManager.prisma.comment.findFirstOrThrow({
      where: { id: Number(reply.id) },
    });
    expect(dbReply.parentId).toBe(Number(parent.id));
  });

  it('должен вернуть 401 UNAUTHORIZED без JWT', async () => {
    const { postId } = await createAuthorWithPublishedPost();

    await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${postId}/comments`)
      .send({ text: 'Comment' })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего поста', async () => {
    const { authorAccessToken } = await createAuthorWithPublishedPost();
    const nonExistentPostId = 999999;

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      nonExistentPostId,
      { text: 'Comment' },
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${nonExistentPostId}/comments`,
      method: 'POST',
      message: 'Post not found',
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

    const res: Response = await commentTestManager.create(
      accessToken,
      draftPost.id,
      { text: 'Comment' },
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${draftPost.id}/comments`,
      method: 'POST',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND для soft-deleted поста', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    await appTestManager.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      postId,
      { text: 'Comment' },
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments`,
      method: 'POST',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND для невалидного parentId', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      postId,
      { text: 'Reply', parentId: '999999' },
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${postId}/comments`,
      method: 'POST',
      message: 'Parent comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND если parentId из другого поста', async () => {
    const users = await authTestManager.registrationWithConfirmation([], 1);
    const [author] = users;
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 2);

    const [post, otherPost] = await appTestManager.prisma.post.findMany({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
      orderBy: { id: 'asc' },
    });

    const parentOnOtherPost = await commentTestManager.createAndGetBody(
      authorAccessToken,
      otherPost.id,
      { text: 'Other post comment' },
    );

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      post.id,
      { text: 'Cross-post reply', parentId: parentOnOtherPost.id },
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toMatchObject({
      message: 'Parent comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
    });
  });

  it('должен вернуть 404 NOT_FOUND если родительский комментарий soft-deleted', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    const parent = await commentTestManager.createAndGetBody(authorAccessToken, postId, {
      text: 'Parent',
    });

    await commentTestManager.softDelete(Number(parent.id));

    const res: Response = await commentTestManager.create(
      authorAccessToken,
      postId,
      { text: 'Reply', parentId: parent.id },
      HttpStatus.NOT_FOUND,
    );

    expect(res.body).toMatchObject({
      message: 'Parent comment not found',
      code: SnapFlowDomainExceptionCode.NotFound,
    });
  });
});
