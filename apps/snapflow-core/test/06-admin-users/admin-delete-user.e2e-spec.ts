import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import { Response } from 'supertest';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';

const DELETE_USER_MUTATION = `
  mutation DeleteUser($userId: Int!) {
    deleteUser(userId: $userId) {
      success
    }
  }
`;

type AdminGraphqlError = {
  message: string;
  extensions: {
    code: string;
  };
};

describe('AdminUsersResolver - deleteUser() (POST: /admin/graphql)', () => {
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

  it('должен soft-delete пользователя и вернуть success: true', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'to_delete_user' });

    const res: Response = await adminUsersTestManager.gql(
      DELETE_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.deleteUser).toEqual({ success: true });

    const userInDb = await appTestManager.prisma.user.findUnique({ where: { id: user.id } });
    expect(userInDb?.deletedAt).not.toBeNull();
  });

  it('должен вернуть NotFound при повторном удалении того же пользователя', async () => {
    const user = await adminUsersTestManager.createUser({ username: 'delete_twice_user' });

    await adminUsersTestManager.gql(DELETE_USER_MUTATION, { userId: user.id }, sessionCookie);

    const res: Response = await adminUsersTestManager.gql(
      DELETE_USER_MUTATION,
      { userId: user.id },
      sessionCookie,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toBeNull();

    const error: AdminGraphqlError = res.body.errors[0];
    expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.NotFound);
  });
});
