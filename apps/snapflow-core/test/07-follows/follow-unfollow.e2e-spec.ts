import { Server } from 'http';
import request, { Response } from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { AppTestManager } from '../managers/app.test-manager';
import { AuthTestManager } from '../managers/auth.test-manager';
import { FollowTestManager } from '../managers/follow.test-manager';
import { ProfileTestManager } from '../managers/profile.test-manager';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { EmailService } from '../../src/modules/notifications/emails/services/email.service';
import { EmailTemplate } from '../../src/modules/notifications/emails/templates/types';
import { UserWithEmailConfirmation } from '../../src/modules/user-accounts/users/types/user-with-confirmation.type';
import { ErrorResponseDto } from '../../src/common/exceptions/error-response-body.dto';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { UserProfile } from '@generated/prisma-snapflow';

const DEFAULT_PASSWORD = 'Qwerty_1';

describe('UsersFollowController - follow/unfollow (POST/DELETE: /users/:userId/follow)', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;
  let followTestManager: FollowTestManager;
  let profileTestManager: ProfileTestManager;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
    authTestManager = new AuthTestManager(appTestManager.prisma, server);
    followTestManager = new FollowTestManager(appTestManager.prisma, server);
    profileTestManager = new ProfileTestManager(appTestManager.prisma, server);

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

  async function createTwoUsers(): Promise<{
    follower: UserWithEmailConfirmation;
    target: UserWithEmailConfirmation;
    followerAccessToken: string;
    targetAccessToken: string;
    targetProfile: UserProfile;
  }> {
    const [follower, target] = await authTestManager.registrationWithConfirmation([], 2);

    const followerAccessToken = await loginUser(follower.email);
    const targetAccessToken = await loginUser(target.email);

    const targetProfile = await appTestManager.prisma.userProfile.findFirstOrThrow({
      where: { userId: target.id },
    });

    return { follower, target, followerAccessToken, targetAccessToken, targetProfile };
  }

  it('должен выполнить сценарий follow -> unfollow -> повторный follow и корректно обновить счётчики профиля', async () => {
    const { follower, target, followerAccessToken, targetProfile } = await createTwoUsers();

    const followerProfile = await appTestManager.prisma.userProfile.findFirstOrThrow({
      where: { userId: follower.id },
    });

    const initialTargetProfile = await profileTestManager.findProfileByProfileId(targetProfile.id);
    expect(initialTargetProfile.userMetadata.followersCount).toBe(0);
    expect(initialTargetProfile.userMetadata.followingCount).toBe(0);

    const initialFollowerProfile = await profileTestManager.findProfileByProfileId(followerProfile.id);
    expect(initialFollowerProfile.userMetadata.followersCount).toBe(0);
    expect(initialFollowerProfile.userMetadata.followingCount).toBe(0);

    await followTestManager.follow(followerAccessToken, target.id);

    expect(await followTestManager.isActiveFollow(follower.id, target.id)).toBe(true);

    const afterFollowTargetProfile = await profileTestManager.findProfileByProfileId(targetProfile.id);
    expect(afterFollowTargetProfile.userMetadata.followersCount).toBe(1);
    expect(afterFollowTargetProfile.userMetadata.followingCount).toBe(0);

    const afterFollowFollowerProfile = await profileTestManager.findProfileByProfileId(
      followerProfile.id,
    );
    expect(afterFollowFollowerProfile.userMetadata.followingCount).toBe(1);
    expect(afterFollowFollowerProfile.userMetadata.followersCount).toBe(0);

    await followTestManager.unfollow(followerAccessToken, target.id);

    const followAfterUnfollow = await followTestManager.findFollowRecord(follower.id, target.id);
    expect(followAfterUnfollow).not.toBeNull();
    expect(followAfterUnfollow!.deletedAt).not.toBeNull();
    expect(await followTestManager.isActiveFollow(follower.id, target.id)).toBe(false);

    const afterUnfollowTargetProfile = await profileTestManager.findProfileByProfileId(
      targetProfile.id,
    );
    expect(afterUnfollowTargetProfile.userMetadata.followersCount).toBe(0);

    const afterUnfollowFollowerProfile = await profileTestManager.findProfileByProfileId(
      followerProfile.id,
    );
    expect(afterUnfollowFollowerProfile.userMetadata.followingCount).toBe(0);

    await followTestManager.follow(followerAccessToken, target.id);

    const followAfterRefollow = await followTestManager.findFollowRecord(follower.id, target.id);
    expect(followAfterRefollow).not.toBeNull();
    expect(followAfterRefollow!.deletedAt).toBeNull();
    expect(await followTestManager.isActiveFollow(follower.id, target.id)).toBe(true);

    const afterRefollowTargetProfile = await profileTestManager.findProfileByProfileId(
      targetProfile.id,
    );
    expect(afterRefollowTargetProfile.userMetadata.followersCount).toBe(1);

    const afterRefollowFollowerProfile = await profileTestManager.findProfileByProfileId(
      followerProfile.id,
    );
    expect(afterRefollowFollowerProfile.userMetadata.followingCount).toBe(1);
  });

  it('должен вернуть 400 BAD_REQUEST при попытке подписаться на самого себя', async () => {
    const { accessToken, createdUser } = await authTestManager.loginAndGetAuthTokens();

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/${createdUser.id}/follow`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/${createdUser.id}/follow`,
      method: 'POST',
      message: 'You cannot follow yourself',
      code: SnapFlowDomainExceptionCode.BadRequest,
      extensions: [],
    });
  });

  it('должен вернуть 404 NOT_FOUND при попытке подписаться на несуществующего пользователя', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();
    const nonExistentUserId = 999999;

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/${nonExistentUserId}/follow`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/${nonExistentUserId}/follow`,
      method: 'POST',
      message: 'User not found',
      code: SnapFlowDomainExceptionCode.NotFound,
      extensions: [],
    });
  });

  it('должен вернуть 403 FORBIDDEN при попытке подписаться на забаненного пользователя', async () => {
    const { followerAccessToken, target } = await createTwoUsers();

    await appTestManager.prisma.user.update({
      where: { id: target.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const res: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/users/${target.id}/follow`)
      .set('Authorization', `Bearer ${followerAccessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body).toEqual<ErrorResponseDto>({
      timestamp: expect.any(String),
      path: `/${GLOBAL_PREFIX}/users/${target.id}/follow`,
      method: 'POST',
      message: 'Cannot follow a blocked user',
      code: SnapFlowDomainExceptionCode.Forbidden,
      extensions: [],
    });
  });

  it('должен вернуть 401 UNAUTHORIZED при вызове follow без JWT', async () => {
    const { target } = await createTwoUsers();

    await request(server)
      .post(`/${GLOBAL_PREFIX}/users/${target.id}/follow`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('должен вернуть 401 UNAUTHORIZED при вызове unfollow без JWT', async () => {
    const { target } = await createTwoUsers();

    await request(server)
      .delete(`/${GLOBAL_PREFIX}/users/${target.id}/follow`)
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
