import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserProfile } from '@generated/prisma-snapflow';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { FollowTestManager } from '../managers/follow.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

const DEFAULT_PASSWORD = 'Qwerty_1';

type ProfileFollowListItem = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  profileId: number;
  isFollowing: boolean;
};

type ProfileFollowListPage = {
  items: ProfileFollowListItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

describe('ProfileController - followers/following lists (GET: /users/profile/:profileId/following|followers)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let followTestManager: FollowTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    followTestManager = new FollowTestManager(appTestManager.prisma, server);

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    const adminSettings = configService.get<AdminSettings>('adminSettings');
    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);

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

  function getProfileFollowing(
    accessToken: string | undefined,
    profileId: number,
    query?: { cursor?: string; limit?: number },
  ) {
    const req = request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profileId}/following`)
      .query(query ?? {});

    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }

    return req;
  }

  function getProfileFollowers(
    accessToken: string | undefined,
    profileId: number,
    query?: { cursor?: string; limit?: number },
  ) {
    const req = request(server)
      .get(`/${GLOBAL_PREFIX}/users/profile/${profileId}/followers`)
      .query(query ?? {});

    if (accessToken) {
      req.set('Authorization', `Bearer ${accessToken}`);
    }

    return req;
  }

  async function getProfileForUser(userId: number): Promise<UserProfile> {
    return appTestManager.prisma.userProfile.findFirstOrThrow({
      where: { userId },
    });
  }

  async function ensureUserProfile(userId: number): Promise<UserProfile> {
    const existing = await appTestManager.prisma.userProfile.findFirst({
      where: { userId, deletedAt: null },
    });

    if (existing) {
      return existing;
    }

    return appTestManager.prisma.userProfile.create({
      data: { userId },
    });
  }

  async function createFollowWithCreatedAt(
    followerId: number,
    followingId: number,
    createdAt: Date,
  ): Promise<void> {
    await appTestManager.prisma.userFollow.create({
      data: { followerId, followingId, createdAt },
    });
  }

  it('должен вернуть 401 UNAUTHORIZED при вызове following без JWT', async () => {
    const [owner] = await authTestManager.registrationWithConfirmation();
    const ownerProfile = await getProfileForUser(owner.id);

    await getProfileFollowing(undefined, ownerProfile.id).expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 401 UNAUTHORIZED при вызове followers без JWT', async () => {
    const [owner] = await authTestManager.registrationWithConfirmation();
    const ownerProfile = await getProfileForUser(owner.id);

    await getProfileFollowers(undefined, ownerProfile.id).expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен показать пользователя в following и followers после follow', async () => {
    const [follower, target] = await authTestManager.registrationWithConfirmation([], 2);

    const followerAccessToken = await loginUser(follower.email);
    const viewerAccessToken = await loginUser(target.email);

    const followerProfile = await getProfileForUser(follower.id);
    const targetProfile = await getProfileForUser(target.id);

    await followTestManager.follow(followerAccessToken, target.id);

    const followingRes: Response = await getProfileFollowing(
      viewerAccessToken,
      followerProfile.id,
    ).expect(HttpStatus.OK);

    const followingBody = followingRes.body as ProfileFollowListPage;
    expect(followingBody.items).toHaveLength(1);
    expect(followingBody.items[0]).toEqual({
      userId: target.id.toString(),
      username: target.username,
      avatarUrl: null,
      profileId: targetProfile.id,
      isFollowing: false,
    });
    expect(followingBody.hasMore).toBe(false);
    expect(followingBody.nextCursor).toBeNull();

    const followersRes: Response = await getProfileFollowers(
      viewerAccessToken,
      targetProfile.id,
    ).expect(HttpStatus.OK);

    const followersBody = followersRes.body as ProfileFollowListPage;
    expect(followersBody.items).toHaveLength(1);
    expect(followersBody.items[0]).toEqual({
      userId: follower.id.toString(),
      username: follower.username,
      avatarUrl: null,
      profileId: followerProfile.id,
      isFollowing: false,
    });
    expect(followersBody.hasMore).toBe(false);
    expect(followersBody.nextCursor).toBeNull();
  });

  it('должен вернуть следующую страницу following по nextCursor без дубликатов', async () => {
    const [viewer, owner] = await authTestManager.registrationWithConfirmation([], 2);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerProfile = await getProfileForUser(owner.id);

    const targets = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const user = await adminUsersTestManager.createUser({
          username: `following_paginated_${i}`,
        });
        await ensureUserProfile(user.id);
        return user;
      }),
    );

    for (let i = 0; i < targets.length; i++) {
      await createFollowWithCreatedAt(owner.id, targets[i].id, new Date(Date.UTC(2024, 0, 1 + i)));
    }

    const page1: Response = await getProfileFollowing(viewerAccessToken, ownerProfile.id, {
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page1.body.items).toHaveLength(8);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2: Response = await getProfileFollowing(viewerAccessToken, ownerProfile.id, {
      cursor: page1.body.nextCursor,
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.nextCursor).toBeNull();

    const page1Ids = page1.body.items.map((item: ProfileFollowListItem) => item.userId);
    const page2Ids = page2.body.items.map((item: ProfileFollowListItem) => item.userId);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it('должен вернуть следующую страницу followers по nextCursor без дубликатов', async () => {
    const [viewer, owner] = await authTestManager.registrationWithConfirmation([], 2);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerProfile = await getProfileForUser(owner.id);

    const followers = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const user = await adminUsersTestManager.createUser({
          username: `followers_paginated_${i}`,
        });
        await ensureUserProfile(user.id);
        return user;
      }),
    );

    for (let i = 0; i < followers.length; i++) {
      await createFollowWithCreatedAt(
        followers[i].id,
        owner.id,
        new Date(Date.UTC(2024, 0, 1 + i)),
      );
    }

    const page1: Response = await getProfileFollowers(viewerAccessToken, ownerProfile.id, {
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page1.body.items).toHaveLength(8);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2: Response = await getProfileFollowers(viewerAccessToken, ownerProfile.id, {
      cursor: page1.body.nextCursor,
      limit: 8,
    }).expect(HttpStatus.OK);

    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.nextCursor).toBeNull();

    const page1Ids = page1.body.items.map((item: ProfileFollowListItem) => item.userId);
    const page2Ids = page2.body.items.map((item: ProfileFollowListItem) => item.userId);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it('не должен возвращать soft-deleted пользователей в following', async () => {
    const [viewer, owner] = await authTestManager.registrationWithConfirmation([], 2);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerProfile = await getProfileForUser(owner.id);

    const activeUser = await adminUsersTestManager.createUser({
      username: 'following_active_user',
    });
    await ensureUserProfile(activeUser.id);

    const deletedUser = await adminUsersTestManager.createUser({
      username: 'following_deleted_user',
      deletedAt: new Date(),
    });
    await ensureUserProfile(deletedUser.id);

    await createFollowWithCreatedAt(owner.id, activeUser.id, new Date(Date.UTC(2024, 0, 1)));
    await createFollowWithCreatedAt(owner.id, deletedUser.id, new Date(Date.UTC(2024, 0, 2)));

    const res: Response = await getProfileFollowing(viewerAccessToken, ownerProfile.id).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].userId).toBe(activeUser.id.toString());
    expect(res.body.items[0].username).toBe('following_active_user');
  });

  it('не должен возвращать soft-deleted пользователей в followers', async () => {
    const [viewer, owner] = await authTestManager.registrationWithConfirmation([], 2);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerProfile = await getProfileForUser(owner.id);

    const activeUser = await adminUsersTestManager.createUser({
      username: 'followers_active_user',
    });
    await ensureUserProfile(activeUser.id);

    const deletedUser = await adminUsersTestManager.createUser({
      username: 'followers_deleted_user',
      deletedAt: new Date(),
    });
    await ensureUserProfile(deletedUser.id);

    await createFollowWithCreatedAt(activeUser.id, owner.id, new Date(Date.UTC(2024, 0, 1)));
    await createFollowWithCreatedAt(deletedUser.id, owner.id, new Date(Date.UTC(2024, 0, 2)));

    const res: Response = await getProfileFollowers(viewerAccessToken, ownerProfile.id).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].userId).toBe(activeUser.id.toString());
    expect(res.body.items[0].username).toBe('followers_active_user');
  });

  it('не должен возвращать забаненных пользователей в following', async () => {
    const [viewer, owner] = await authTestManager.registrationWithConfirmation([], 2);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerProfile = await getProfileForUser(owner.id);

    const activeUser = await adminUsersTestManager.createUser({ username: 'following_not_banned' });
    await ensureUserProfile(activeUser.id);

    const bannedUser = await adminUsersTestManager.createUser({ username: 'following_banned' });
    await ensureUserProfile(bannedUser.id);

    await createFollowWithCreatedAt(owner.id, activeUser.id, new Date(Date.UTC(2024, 0, 1)));
    await createFollowWithCreatedAt(owner.id, bannedUser.id, new Date(Date.UTC(2024, 0, 2)));

    await appTestManager.prisma.user.update({
      where: { id: bannedUser.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const res: Response = await getProfileFollowing(viewerAccessToken, ownerProfile.id).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].userId).toBe(activeUser.id.toString());
    expect(res.body.items[0].username).toBe('following_not_banned');
  });

  it('не должен возвращать забаненных пользователей в followers', async () => {
    const [viewer, owner] = await authTestManager.registrationWithConfirmation([], 2);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerProfile = await getProfileForUser(owner.id);

    const activeUser = await adminUsersTestManager.createUser({ username: 'followers_not_banned' });
    await ensureUserProfile(activeUser.id);

    const bannedUser = await adminUsersTestManager.createUser({ username: 'followers_banned' });
    await ensureUserProfile(bannedUser.id);

    await createFollowWithCreatedAt(activeUser.id, owner.id, new Date(Date.UTC(2024, 0, 1)));
    await createFollowWithCreatedAt(bannedUser.id, owner.id, new Date(Date.UTC(2024, 0, 2)));

    await appTestManager.prisma.user.update({
      where: { id: bannedUser.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const res: Response = await getProfileFollowers(viewerAccessToken, ownerProfile.id).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].userId).toBe(activeUser.id.toString());
    expect(res.body.items[0].username).toBe('followers_not_banned');
  });

  it('должен вернуть элементы с полями userId, username, avatarUrl, profileId и isFollowing', async () => {
    const [viewer, owner, target] = await authTestManager.registrationWithConfirmation([], 3);
    const viewerAccessToken = await loginUser(viewer.email);
    const ownerAccessToken = await loginUser(owner.email);

    const ownerProfile = await getProfileForUser(owner.id);
    const targetProfile = await getProfileForUser(target.id);

    const avatarUrl = 'https://cdn.snapflow.cc/avatars/follow-list-test.jpg';
    await appTestManager.prisma.userProfile.update({
      where: { id: targetProfile.id },
      data: { avatarUrl },
    });

    await followTestManager.follow(ownerAccessToken, target.id);
    await followTestManager.follow(viewerAccessToken, target.id);

    const res: Response = await getProfileFollowing(viewerAccessToken, ownerProfile.id).expect(
      HttpStatus.OK,
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual({
      userId: target.id.toString(),
      username: target.username,
      avatarUrl,
      profileId: targetProfile.id,
      isFollowing: true,
    });
  });
});
