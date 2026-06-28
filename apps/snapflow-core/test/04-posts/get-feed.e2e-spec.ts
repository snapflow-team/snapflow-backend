import { HttpStatus } from '@nestjs/common';
import { PostStatus, UserProfile } from '@generated/prisma-snapflow';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { PostViewDto } from '../../src/modules/posts/api/view-dto/post.view-dto';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { CommentTestManager } from '../managers/comment.test-manager';
import { FollowTestManager } from '../managers/follow.test-manager';
import { PostLikeTestManager } from '../managers/post-like.test-manager';
import { PostTestManager } from '../managers/post.test-manager';

const DEFAULT_PASSWORD = 'Qwerty_1';

describe('PostsController - getFeed() (GET: /posts/feed)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let followTestManager: FollowTestManager;
  let postTestManager: PostTestManager;
  let postLikeTestManager: PostLikeTestManager;
  let commentTestManager: CommentTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    followTestManager = new FollowTestManager(appTestManager.prisma, server);
    postTestManager = new PostTestManager(appTestManager.prisma);
    postLikeTestManager = new PostLikeTestManager(appTestManager.prisma, server);
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

  async function createFollowerAndAuthor(): Promise<{
    follower: UserWithEmailConfirmation;
    author: UserWithEmailConfirmation;
    followerAccessToken: string;
    authorAccessToken: string;
    authorProfile: UserProfile;
  }> {
    const [follower, author] = await authTestManager.registrationWithConfirmation([], 2);

    const followerAccessToken = await loginUser(follower.email);
    const authorAccessToken = await loginUser(author.email);

    const authorProfile = await appTestManager.prisma.userProfile.findFirstOrThrow({
      where: { userId: author.id },
    });

    return { follower, author, followerAccessToken, authorAccessToken, authorProfile };
  }

  function getFeed(accessToken: string, query: { cursor?: string; limit?: number } = {}) {
    return request(server)
      .get(`/${GLOBAL_PREFIX}/posts/feed`)
      .set('Authorization', `Bearer ${accessToken}`)
      .query(query);
  }

  async function createPublishedPostsWithDates(
    userId: number,
    count: number,
  ): Promise<Array<{ id: number; createdAt: Date }>> {
    const baseDate = new Date('2026-01-01T12:00:00.000Z');
    const posts: Array<{ id: number; createdAt: Date }> = [];

    for (let i = 0; i < count; i++) {
      const post = await appTestManager.prisma.post.create({
        data: {
          userId,
          description: `Feed post ${i}`,
          status: PostStatus.PUBLISHED,
          createdAt: new Date(baseDate.getTime() + i * 60_000),
        },
      });

      posts.push({ id: post.id, createdAt: post.createdAt });
    }

    return posts;
  }

  it('должен вернуть пост автора подписки с enrichment-полями после follow -> publish', async () => {
    const { follower, author, followerAccessToken, authorProfile } =
      await createFollowerAndAuthor();

    await followTestManager.follow(followerAccessToken, author.id);
    await postTestManager.createPublishedPost(author.id, [], 1);

    const post = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: author.id, status: PostStatus.PUBLISHED, deletedAt: null },
    });

    await postLikeTestManager.toggle(followerAccessToken, post.id);
    await commentTestManager.createAndGetBody(followerAccessToken, post.id, {
      text: 'Nice post!',
    });

    const res: Response = await getFeed(followerAccessToken).expect(HttpStatus.OK);

    expect(res.body.items).toHaveLength(1);

    const item = res.body.items[0] as PostViewDto;

    expect(item).toEqual<PostViewDto>({
      id: post.id.toString(),
      description: expect.any(String),
      status: PostStatus.PUBLISHED,
      createdAt: post.createdAt.toISOString(),
      postMedias: [],
      owner: {
        userId: author.id.toString(),
        profileId: authorProfile.id.toString(),
        username: author.username,
        avatarUrl: null,
      },
      likesCount: 1,
      commentsCount: 1,
      isLikedByCurrentUser: true,
      recentLikers: [
        {
          userId: follower.id.toString(),
          avatarUrl: null,
        },
      ],
    });

    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it('должен вернуть следующую страницу по nextCursor без дубликатов в порядке newest-first', async () => {
    const { follower, author, followerAccessToken } = await createFollowerAndAuthor();

    await followTestManager.follow(followerAccessToken, author.id);

    const posts = await createPublishedPostsWithDates(author.id, 10);
    const expectedNewestFirstIds = [...posts].reverse().map((p) => p.id.toString());

    const page1: Response = await getFeed(followerAccessToken, { limit: 4 }).expect(HttpStatus.OK);

    expect(page1.body.items).toHaveLength(4);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();
    expect(page1.body.items.map((item: PostViewDto) => item.id)).toEqual(
      expectedNewestFirstIds.slice(0, 4),
    );

    const page2: Response = await getFeed(followerAccessToken, {
      cursor: page1.body.nextCursor,
      limit: 4,
    }).expect(HttpStatus.OK);

    expect(page2.body.items).toHaveLength(4);
    expect(page2.body.hasMore).toBe(true);
    expect(page2.body.nextCursor).toBeTruthy();
    expect(page2.body.items.map((item: PostViewDto) => item.id)).toEqual(
      expectedNewestFirstIds.slice(4, 8),
    );

    const page3: Response = await getFeed(followerAccessToken, {
      cursor: page2.body.nextCursor,
      limit: 4,
    }).expect(HttpStatus.OK);

    expect(page3.body.items).toHaveLength(2);
    expect(page3.body.hasMore).toBe(false);
    expect(page3.body.nextCursor).toBeNull();
    expect(page3.body.items.map((item: PostViewDto) => item.id)).toEqual(
      expectedNewestFirstIds.slice(8, 10),
    );

    const allIds = [
      ...page1.body.items.map((item: PostViewDto) => item.id),
      ...page2.body.items.map((item: PostViewDto) => item.id),
      ...page3.body.items.map((item: PostViewDto) => item.id),
    ];

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds).toEqual(expectedNewestFirstIds);
  });

  it('должен вернуть пустую ленту, если у пользователя нет подписок', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await getFeed(accessToken).expect(HttpStatus.OK);

    expect(res.body).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it('не должен возвращать посты забаненного автора среди подписок', async () => {
    const [follower, bannedAuthor, activeAuthor] =
      await authTestManager.registrationWithConfirmation([], 3);

    const followerAccessToken = await loginUser(follower.email);

    await followTestManager.follow(followerAccessToken, bannedAuthor.id);
    await followTestManager.follow(followerAccessToken, activeAuthor.id);

    await postTestManager.createPublishedPost(bannedAuthor.id, [], 1);
    await postTestManager.createPublishedPost(activeAuthor.id, [], 1);

    const bannedAuthorPost = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: bannedAuthor.id, status: PostStatus.PUBLISHED, deletedAt: null },
    });
    const activeAuthorPost = await appTestManager.prisma.post.findFirstOrThrow({
      where: { userId: activeAuthor.id, status: PostStatus.PUBLISHED, deletedAt: null },
    });

    await appTestManager.prisma.user.update({
      where: { id: bannedAuthor.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const res: Response = await getFeed(followerAccessToken).expect(HttpStatus.OK);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(activeAuthorPost.id.toString());
    expect(res.body.items.map((item: PostViewDto) => item.id)).not.toContain(
      bannedAuthorPost.id.toString(),
    );
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it('не должен возвращать 401 UNAUTHORIZED без JWT', async () => {
    await request(server).get(`/${GLOBAL_PREFIX}/posts/feed`).expect(HttpStatus.UNAUTHORIZED);
  });
});
