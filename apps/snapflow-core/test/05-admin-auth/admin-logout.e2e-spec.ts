import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { AdminSession } from '@generated/prisma-snapflow';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { ADMIN_SESSION_COOKIE_NAME } from '../../src/modules/admin/constants/admin-auth.constants';
import { ADMIN_GRAPHQL_PATH } from '../../src/setup/admin-graphql.module-options';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminAuthTestManager } from '../managers/admin-auth.test-manager';
import { AppTestManager } from '../managers/app.test-manager';

const ADMIN_LOGOUT_MUTATION = `
  mutation AdminLogout {
    adminLogout {
      success
    }
  }
`;

type AdminGraphqlError = {
  message: string;
  extensions: {
    code: string;
    fields?: Array<{ field: string; message: string }>;
  };
};

describe('AdminAuthResolver - adminLogout() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminAuthTestManager: AdminAuthTestManager;
  let server: Server;
  let adminSettings: AdminSettings;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    adminSettings = configService.get<AdminSettings>('adminSettings');

    adminAuthTestManager = new AdminAuthTestManager(appTestManager.prisma, server, adminSettings);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен успешно разлогинить суперадмина, очистить adminSessionId cookie и soft-delete сессию в БД', async () => {
    const { sessionCookie } = await adminAuthTestManager.login();
    expect(sessionCookie).toBeDefined();

    const sessionId = sessionCookie!.split('=')[1];

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Cookie', sessionCookie!)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toEqual({ adminLogout: { success: true } });
    expect(res.body.errors).toBeUndefined();

    const setCookieHeader: string = res.headers['set-cookie'][0];
    expect(setCookieHeader).toMatch(new RegExp(`${ADMIN_SESSION_COOKIE_NAME}=`));
    expect(setCookieHeader).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);

    const session: AdminSession | null = await appTestManager.prisma.adminSession.findUnique({
      where: { id: sessionId },
    });

    expect(session?.deletedAt).not.toBeNull();

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(0);
  });

  it('не должен разлогинить суперадмина без cookie adminSessionId (Unauthorized)', async () => {
    await adminAuthTestManager.login();

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expectUnauthorizedLogoutError(res);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(1);
  });

  it('не должен разлогинить суперадмина при случайном несуществующем sessionId (Unauthorized)', async () => {
    const randomSessionId = crypto.randomUUID();

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Cookie', `${ADMIN_SESSION_COOKIE_NAME}=${randomSessionId}`)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expectUnauthorizedLogoutError(res);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(0);
  });

  it('не должен разлогинить суперадмина при просроченной сессии в cookie (Unauthorized)', async () => {
    const expiredSession: AdminSession = await adminAuthTestManager.seedSession({
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Cookie', `${ADMIN_SESSION_COOKIE_NAME}=${expiredSession.id}`)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expectUnauthorizedLogoutError(res);

    const session: AdminSession | null = await appTestManager.prisma.adminSession.findUnique({
      where: { id: expiredSession.id },
    });

    expect(session?.deletedAt).toBeNull();
  });

  it('не должен разлогинить суперадмина при уже удалённой сессии в cookie (Unauthorized)', async () => {
    const deletedSession: AdminSession = await adminAuthTestManager.seedSession({
      expiresAt: new Date(Date.now() + 3600_000),
      deletedAt: new Date(),
    });

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Cookie', `${ADMIN_SESSION_COOKIE_NAME}=${deletedSession.id}`)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expectUnauthorizedLogoutError(res);

    const session: AdminSession | null = await appTestManager.prisma.adminSession.findUnique({
      where: { id: deletedSession.id },
    });

    expect(session?.deletedAt).not.toBeNull();
  });

  it('не должен разлогинить суперадмина при повторном adminLogout с тем же cookie (Unauthorized)', async () => {
    const { sessionCookie } = await adminAuthTestManager.login();
    expect(sessionCookie).toBeDefined();

    await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Cookie', sessionCookie!)
      .send({ query: ADMIN_LOGOUT_MUTATION })
      .expect(HttpStatus.OK);

    const secondLogoutRes: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Cookie', sessionCookie!)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expectUnauthorizedLogoutError(secondLogoutRes);
  });

  it('не должен разлогинить суперадмина, если sessionId передан в заголовке вместо cookie (Unauthorized)', async () => {
    const { sessionCookie } = await adminAuthTestManager.login();
    expect(sessionCookie).toBeDefined();

    const sessionId = sessionCookie!.split('=')[1];

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .set('Authorization', `Bearer ${sessionId}`)
      .send({ query: ADMIN_LOGOUT_MUTATION });

    expectUnauthorizedLogoutError(res);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(1);
  });
});

function expectUnauthorizedLogoutError(res: Response): void {
  expect(res.status).toBe(HttpStatus.OK);
  expect(res.body.data).toBeNull();
  expect(res.body.errors).toHaveLength(1);

  const error: AdminGraphqlError = res.body.errors[0];
  expect(error.message).toBe('Admin is not authenticated');
  expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.Unauthorized);
  expect(error.extensions.fields).toEqual([]);
}
