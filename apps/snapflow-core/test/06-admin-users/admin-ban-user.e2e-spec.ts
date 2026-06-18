import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import { Response } from 'supertest';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { ADMIN_SESSION_COOKIE_NAME } from '../../src/modules/admin/constants/admin-auth.constants';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

const BAN_USER_MUTATION = `
  mutation BanUser($userId: Int!, $reason: UserBanReason!, $customReason: String) {
    banUser(userId: $userId, reason: $reason, customReason: $customReason) {
      success
    }
  }
`;

const UNBAN_USER_MUTATION = `
  mutation UnbanUser($userId: Int!) {
    unbanUser(userId: $userId) {
      success
    }
  }
`;

type AdminGraphqlError = {
  extensions: {
    code: string;
  };
};

describe('AdminUsersResolver - banUser()/unbanUser() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let server: Server;
  let sessionCookie: string;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    const adminSettings = configService.get<AdminSettings>('adminSettings');

    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);
    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();
    sessionCookie = await adminUsersTestManager.loginAsAdmin();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен успешно забанить пользователя (isBanned=true, banReason и bannedAt выставлены)', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'ban_target' });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'BadBehavior' },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.banUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });

    expect(userInDb?.isBanned).toBe(true);
    expect(userInDb?.banReason).toBe('Bad behavior');
    expect(userInDb?.bannedAt).not.toBeNull();
  });

  it('должен успешно разбанить пользователя (сбросить поля бана)', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'unban_target' });
    await appTestManager.prisma.user.update({
      where: { id: user.id },
      data: {
        isBanned: true,
        banReason: 'Bad behavior',
        bannedAt: new Date(),
      },
    });

    const res: Response = await adminUsersTestManager.gql(
      UNBAN_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.unbanUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userInDb?.isBanned).toBe(false);
    expect(userInDb?.banReason).toBeNull();
    expect(userInDb?.bannedAt).toBeNull();
  });

  it('должен вернуть validation error при reason=AnotherReason без customReason', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'missing_custom_reason' });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AnotherReason' },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toBe('Validation failed');
  });

  it('должен вернуть validation error при reason=AnotherReason и customReason только из пробелов', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'blank_custom_reason' });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AnotherReason', customReason: '   ' },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toBe('Validation failed');
  });

  it('должен вернуть validation error при reason=AnotherReason и customReason длиной больше 500', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'too_long_custom_reason' });
    const tooLongCustomReason = 'a'.repeat(501);

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AnotherReason', customReason: tooLongCustomReason },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toBe('Validation failed');
  });

  it('должен сохранять mapping для reason=AdvertisingPlacement', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'advertising_mapping_target' });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AdvertisingPlacement' },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.banUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userInDb?.isBanned).toBe(true);
    expect(userInDb?.banReason).toBe('Advertising placement');
    expect(userInDb?.bannedAt).not.toBeNull();
  });

  it('должен сохранять trimmed customReason для reason=AnotherReason', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'another_reason_target' });
    const customReason = '   custom reason with spaces   ';

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AnotherReason', customReason },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.banUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userInDb?.isBanned).toBe(true);
    expect(userInDb?.banReason).toBe('custom reason with spaces');
    expect(userInDb?.bannedAt).not.toBeNull();
  });

  it('должен игнорировать customReason для enum-причин и использовать mapping', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'enum_reason_ignore' });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      {
        userId: user.id,
        reason: 'BadBehavior',
        customReason: 'this should be ignored',
      },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.banUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userInDb?.isBanned).toBe(true);
    expect(userInDb?.banReason).toBe('Bad behavior');
    expect(userInDb?.bannedAt).not.toBeNull();
  });

  it('должен игнорировать customReason для reason=AdvertisingPlacement и использовать mapping', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'adv_ignore_custom' });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      {
        userId: user.id,
        reason: 'AdvertisingPlacement',
        customReason: 'this should be ignored too',
      },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.banUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userInDb?.isBanned).toBe(true);
    expect(userInDb?.banReason).toBe('Advertising placement');
    expect(userInDb?.bannedAt).not.toBeNull();
  });

  it('должен вернуть NotFound при banUser для несуществующего пользователя', async () => {
    const nonExistentUserId = 2147483647;

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: nonExistentUserId, reason: 'BadBehavior' },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.NotFound);
  });

  it('должен вернуть NotFound при unbanUser для несуществующего пользователя', async () => {
    const nonExistentUserId = 2147483647;

    const res: Response = await adminUsersTestManager.gql(
      UNBAN_USER_MUTATION,
      { userId: nonExistentUserId },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.NotFound);
  });

  it('должен вернуть NotFound при banUser для soft-deleted пользователя', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'ban_soft_deleted_target' });
    await appTestManager.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'BadBehavior' },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.NotFound);
  });

  it('должен вернуть NotFound при unbanUser для soft-deleted пользователя', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'unban_soft_deleted_target' });
    await appTestManager.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    const res: Response = await adminUsersTestManager.gql(
      UNBAN_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.NotFound);
  });

  it('должен повторно банить уже забаненного пользователя и обновлять bannedAt', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'reban_target' });

    const firstBanRes: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'BadBehavior' },
      sessionCookie,
    );

    expect(firstBanRes.status).toBe(HttpStatus.OK);
    expect(firstBanRes.body.errors).toBeUndefined();
    expect(firstBanRes.body.data.banUser).toEqual({ success: true });

    const userAfterFirstBan = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterFirstBan?.isBanned).toBe(true);
    expect(userAfterFirstBan?.banReason).toBe('Bad behavior');
    expect(userAfterFirstBan?.bannedAt).not.toBeNull();

    const firstBannedAt = userAfterFirstBan?.bannedAt;
    expect(firstBannedAt).toBeDefined();
    if (!firstBannedAt) {
      throw new Error('Expected bannedAt to be set after first ban');
    }

    const secondBanRes: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AdvertisingPlacement' },
      sessionCookie,
    );

    expect(secondBanRes.status).toBe(HttpStatus.OK);
    expect(secondBanRes.body.errors).toBeUndefined();
    expect(secondBanRes.body.data.banUser).toEqual({ success: true });

    const userAfterSecondBan = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterSecondBan?.isBanned).toBe(true);
    expect(userAfterSecondBan?.banReason).toBe('Advertising placement');
    expect(userAfterSecondBan?.bannedAt).not.toBeNull();

    const secondBannedAt = userAfterSecondBan?.bannedAt;
    expect(secondBannedAt).toBeDefined();
    if (!secondBannedAt) {
      throw new Error('Expected bannedAt to be set after second ban');
    }
    expect(secondBannedAt.getTime()).toBeGreaterThanOrEqual(firstBannedAt.getTime());
  });

  it('должен успешно разбанивать уже разбаненного пользователя без изменения бан-полей', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'double_unban_target' });

    const firstUnbanRes: Response = await adminUsersTestManager.gql(
      UNBAN_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(firstUnbanRes.status).toBe(HttpStatus.OK);
    expect(firstUnbanRes.body.errors).toBeUndefined();
    expect(firstUnbanRes.body.data.unbanUser).toEqual({ success: true });

    const userAfterFirstUnban = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterFirstUnban?.isBanned).toBe(false);
    expect(userAfterFirstUnban?.banReason).toBeNull();
    expect(userAfterFirstUnban?.bannedAt).toBeNull();

    const secondUnbanRes: Response = await adminUsersTestManager.gql(
      UNBAN_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(secondUnbanRes.status).toBe(HttpStatus.OK);
    expect(secondUnbanRes.body.errors).toBeUndefined();
    expect(secondUnbanRes.body.data.unbanUser).toEqual({ success: true });

    const userAfterSecondUnban = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterSecondUnban?.isBanned).toBe(false);
    expect(userAfterSecondUnban?.banReason).toBeNull();
    expect(userAfterSecondUnban?.bannedAt).toBeNull();
  });

  it('должен сохранять консистентность полей в цепочке ban -> unban -> ban', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'ban_unban_ban_target' });

    const firstBanRes: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'BadBehavior' },
      sessionCookie,
    );

    expect(firstBanRes.status).toBe(HttpStatus.OK);
    expect(firstBanRes.body.errors).toBeUndefined();
    expect(firstBanRes.body.data.banUser).toEqual({ success: true });

    const userAfterFirstBan = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterFirstBan?.isBanned).toBe(true);
    expect(userAfterFirstBan?.banReason).toBe('Bad behavior');
    expect(userAfterFirstBan?.bannedAt).not.toBeNull();

    const firstBannedAt = userAfterFirstBan?.bannedAt;
    expect(firstBannedAt).toBeDefined();
    if (!firstBannedAt) {
      throw new Error('Expected bannedAt to be set after first ban in chain');
    }

    const unbanRes: Response = await adminUsersTestManager.gql(
      UNBAN_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(unbanRes.status).toBe(HttpStatus.OK);
    expect(unbanRes.body.errors).toBeUndefined();
    expect(unbanRes.body.data.unbanUser).toEqual({ success: true });

    const userAfterUnban = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterUnban?.isBanned).toBe(false);
    expect(userAfterUnban?.banReason).toBeNull();
    expect(userAfterUnban?.bannedAt).toBeNull();

    const secondBanRes: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      { userId: user.id, reason: 'AdvertisingPlacement' },
      sessionCookie,
    );

    expect(secondBanRes.status).toBe(HttpStatus.OK);
    expect(secondBanRes.body.errors).toBeUndefined();
    expect(secondBanRes.body.data.banUser).toEqual({ success: true });

    const userAfterSecondBan = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfterSecondBan?.isBanned).toBe(true);
    expect(userAfterSecondBan?.banReason).toBe('Advertising placement');
    expect(userAfterSecondBan?.bannedAt).not.toBeNull();

    const secondBannedAt = userAfterSecondBan?.bannedAt;
    expect(secondBannedAt).toBeDefined();
    if (!secondBannedAt) {
      throw new Error('Expected bannedAt to be set after second ban in chain');
    }
    expect(secondBannedAt.getTime()).toBeGreaterThanOrEqual(firstBannedAt.getTime());
  });

  it('должен вернуть unauthorized при banUser без admin cookie', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'unauth_no_cookie' });

    const res: Response = await adminUsersTestManager.gql(BAN_USER_MUTATION, {
      userId: user.id,
      reason: 'BadBehavior',
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toBe('Admin is not authenticated');

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.Unauthorized);
  });

  it('должен вернуть unauthorized при banUser с невалидной admin cookie', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'unauth_bad_cookie' });
    const invalidCookie = `${ADMIN_SESSION_COOKIE_NAME}=00000000-0000-0000-0000-000000000001`;

    const res: Response = await adminUsersTestManager.gql(
      BAN_USER_MUTATION,
      {
        userId: user.id,
        reason: 'BadBehavior',
      },
      invalidCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toBe('Admin is not authenticated');

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.Unauthorized);
  });
});
