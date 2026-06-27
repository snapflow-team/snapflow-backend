import { HttpStatus } from '@nestjs/common';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { PostViewDto } from '../../src/modules/posts/api/view-dto/post.view-dto';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { PostLikeTestManager } from '../managers/post-like.test-manager';
import { PostTestManager } from '../managers/post.test-manager';

const DEFAULT_PASSWORD = 'Qwerty_1';

describe('PostsController - togglePostLike() (POST: /posts/:postId/like)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let postTestManager: PostTestManager;
  let postLikeTestManager: PostLikeTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    postTestManager = new PostTestManager(appTestManager.prisma);
    postLikeTestManager = new PostLikeTestManager(appTestManager.prisma, server);

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

  async function createAuthorWithLikers(likerCount: number): Promise<{
    author: UserWithEmailConfirmation;
    authorAccessToken: string;
    postId: number;
    likers: Array<{ user: UserWithEmailConfirmation; accessToken: string }>;
  }> {
    const users = await authTestManager.registrationWithConfirmation([], likerCount + 1);
    const [author, ...likerUsers] = users;
    const authorAccessToken = await loginUser(author.email);

    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: 'PUBLISHED', deletedAt: null },
    });

    const likers = await Promise.all(
      likerUsers.map(async (user) => ({
        user,
        accessToken: await loginUser(user.email),
      })),
    );

    return { author, authorAccessToken, postId: post.id, likers };
  }

  it('должен поставить лайк и вернуть likesCount=1, isLikedByCurrentUser=true с активной записью в БД', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    await postLikeTestManager.toggle(authorAccessToken, postId);

    const post = await postLikeTestManager.getPost(postId, authorAccessToken);

    expect(post.likesCount).toBe(1);
    expect(post.isLikedByCurrentUser).toBe(true);
    expect(await postLikeTestManager.isActiveLike(postId, author.id)).toBe(true);
  });

  it('должен убрать лайк при повторном toggle и вернуть likesCount=0, isLikedByCurrentUser=false', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    await postLikeTestManager.toggle(authorAccessToken, postId);
    await postLikeTestManager.toggle(authorAccessToken, postId);

    const post = await postLikeTestManager.getPost(postId, authorAccessToken);

    expect(post.likesCount).toBe(0);
    expect(post.isLikedByCurrentUser).toBe(false);

    const likeRecord = await postLikeTestManager.findLikeRecord(postId, author.id);
    expect(likeRecord).not.toBeNull();
    expect(likeRecord!.deletedAt).not.toBeNull();
    expect(await postLikeTestManager.isActiveLike(postId, author.id)).toBe(false);
  });

  it('должен корректно обрабатывать повторные toggle (like -> unlike -> re-like) без дубликатов в БД', async () => {
    const { author, authorAccessToken, postId } = await createAuthorWithPublishedPost();

    await postLikeTestManager.toggle(authorAccessToken, postId);
    await postLikeTestManager.toggle(authorAccessToken, postId);
    await postLikeTestManager.toggle(authorAccessToken, postId);

    expect(await postLikeTestManager.countLikeRecords(postId, author.id)).toBe(1);

    const likeRecord = await postLikeTestManager.findLikeRecord(postId, author.id);
    expect(likeRecord!.deletedAt).toBeNull();
    expect(await postLikeTestManager.isActiveLike(postId, author.id)).toBe(true);

    const post = await postLikeTestManager.getPost(postId, authorAccessToken);
    expect(post.likesCount).toBe(1);
    expect(post.isLikedByCurrentUser).toBe(true);
  });

  it('должен вернуть ровно 3 recentLikers в порядке newest-first и пересчитать список после unlike самого свежего', async () => {
    const { postId, likers } = await createAuthorWithLikers(4);

    const baseDate = new Date('2026-01-01T12:00:00.000Z');

    for (let i = 0; i < likers.length; i++) {
      await appTestManager.prisma.postLike.create({
        data: {
          postId,
          userId: likers[i].user.id,
          createdAt: new Date(baseDate.getTime() + i * 60_000),
        },
      });
    }

    const afterFourLikes = await postLikeTestManager.getPost(postId);

    expect(afterFourLikes.likesCount).toBe(4);
    expect(afterFourLikes.recentLikers).toHaveLength(3);
    expect(afterFourLikes.recentLikers.map((liker) => liker.userId)).toEqual([
      likers[3].user.id.toString(),
      likers[2].user.id.toString(),
      likers[1].user.id.toString(),
    ]);

    await postLikeTestManager.toggle(likers[3].accessToken, postId);

    const afterUnlikeNewest = await postLikeTestManager.getPost(postId);

    expect(afterUnlikeNewest.likesCount).toBe(3);
    expect(afterUnlikeNewest.recentLikers).toHaveLength(3);
    expect(afterUnlikeNewest.recentLikers.map((liker) => liker.userId)).toEqual([
      likers[2].user.id.toString(),
      likers[1].user.id.toString(),
      likers[0].user.id.toString(),
    ]);
  });

  it('должен вернуть avatarUrl: null в recentLikers, если у лайкнувшего нет аватара', async () => {
    const { postId, likers } = await createAuthorWithLikers(1);
    const [liker] = likers;

    await postLikeTestManager.toggle(liker.accessToken, postId);

    const post = await postLikeTestManager.getPost(postId);

    expect(post.recentLikers).toEqual([
      {
        userId: liker.user.id.toString(),
        avatarUrl: null,
      },
    ]);
  });

  it('должен вернуть isLikedByCurrentUser=false для гостя на GET /posts/:id', async () => {
    const { authorAccessToken, postId } = await createAuthorWithPublishedPost();

    await postLikeTestManager.toggle(authorAccessToken, postId);

    const post: PostViewDto = await postLikeTestManager.getPost(postId);

    expect(post.likesCount).toBe(1);
    expect(post.isLikedByCurrentUser).toBe(false);
    expect(post.recentLikers).toHaveLength(1);
  });

  it('должен вернуть 401 UNAUTHORIZED при toggle без JWT', async () => {
    const { postId } = await createAuthorWithPublishedPost();

    await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${postId}/like`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 404 NOT_FOUND для несуществующего поста', async () => {
    const { authorAccessToken } = await createAuthorWithPublishedPost();
    const nonExistentPostId = 999999;

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${nonExistentPostId}/like`)
      .set('Authorization', `Bearer ${authorAccessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${nonExistentPostId}/like`,
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

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${draftPost.id}/like`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/posts/${draftPost.id}/like`,
      method: 'POST',
      message: 'Post not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });
});
