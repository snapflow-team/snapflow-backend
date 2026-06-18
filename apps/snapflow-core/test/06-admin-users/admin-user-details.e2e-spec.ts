import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import { Response } from 'supertest';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { ApiSettings } from '../../src/setup/configuration/api-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

const ADMIN_USER_DETAILS_QUERY = `
  query AdminUserDetails($userId: Int!) {
    adminUserDetails(userId: $userId) {
      id
      username
      avatarUrl
      createdAt
      profileLink
    }
  }
`;

type AdminGraphqlError = {
  extensions: {
    code: string;
  };
};

describe('AdminUserDetailsResolver - adminUserDetails() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let server: Server;
  let sessionCookie: string;
  let adminSettings: AdminSettings;
  let apiSettings: ApiSettings;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    adminSettings = configService.get<AdminSettings>('adminSettings');
    apiSettings = configService.get<ApiSettings>('apiSettings');

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

  it('должен вернуть детальную информацию о пользователе с avatarUrl из профиля', async () => {
    const user = await adminUsersTestManager.createUser({
      username: 'details_user',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_USER_DETAILS_QUERY,
      { userId: user.id },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.adminUserDetails).toMatchObject({
      id: user.id,
      username: 'details_user',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      createdAt: user.createdAt.toISOString(),
    });

    expect(res.body.data.adminUserDetails.profileLink).toBe(
      `${apiSettings.baseFrontUrl.replace(/\/$/, '')}/profile/${user.profile!.id}`,
    );
  });

  it('должен вернуть NotFound для несуществующего или удалённого пользователя', async () => {
    const deletedUser = await adminUsersTestManager.createUser({
      username: 'deleted_details_user',
      deletedAt: new Date(),
    });

    const res: Response = await adminUsersTestManager.gql(
      ADMIN_USER_DETAILS_QUERY,
      { userId: deletedUser.id },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.NotFound);
  });
});
