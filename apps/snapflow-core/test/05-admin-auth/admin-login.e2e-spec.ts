import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { SnapFlowDomainExceptionCode } from '../../src/common/exceptions/domain-exception-codes';
import { ADMIN_SESSION_COOKIE_NAME } from '../../src/modules/admin/constants/admin-auth.constants';
import { ADMIN_GRAPHQL_PATH } from '../../src/setup/admin-graphql.module-options';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { ApiSettings } from '../../src/setup/configuration/api-settings';
import { Configuration } from '../../src/setup/configuration/configuration';
import { AdminAuthTestManager } from '../managers/admin-auth.test-manager';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminSession } from '@generated/prisma-snapflow';

const ADMIN_LOGIN_MUTATION = `
  mutation AdminLogin($input: AdminLoginInput!) {
    adminLogin(input: $input) {
      success
    }
  }
`;

const SANITIZED_GRAPHQL_ERROR_CODES = ['BAD_USER_INPUT', 'GRAPHQL_VALIDATION_FAILED'] as const;

type AdminGraphqlError = {
  message: string;
  extensions: {
    code: string;
    fields?: Array<{ field: string; message: string }>;
  };
};

describe('AdminAuthResolver - adminLogin() (POST: /admin/graphql)', () => {
  let appTestManager: AppTestManager;
  let adminAuthTestManager: AdminAuthTestManager;
  let server: Server;
  let adminSettings: AdminSettings;
  let throttleLimit: number;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);
    adminSettings = configService.get<AdminSettings>('adminSettings');
    throttleLimit = configService.get<ApiSettings>('apiSettings').throttleLimit;

    adminAuthTestManager = new AdminAuthTestManager(appTestManager.prisma, server, adminSettings);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен авторизовать суперадмина при валидных email и password', async () => {
    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: {
          input: {
            email: adminSettings.email,
            password: adminSettings.password,
          },
        },
      });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.data).toEqual({ adminLogin: { success: true } });
    expect(res.body.errors).toBeUndefined();

    const sessionCookie: string | undefined = parseAdminSessionCookie(res);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(new RegExp(`^${ADMIN_SESSION_COOKIE_NAME}=`));

    const setCookieHeader: string = res.headers['set-cookie'][0];
    expect(setCookieHeader).toMatch(/HttpOnly/i);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].deletedAt).toBeNull();
    expect(activeSessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('должен оставлять только одну активную сессию при повторном adminLogin', async () => {
    const firstRes: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: {
          input: {
            email: adminSettings.email,
            password: adminSettings.password,
          },
        },
      });
    const firstSessionId: string | undefined = parseAdminSessionCookie(firstRes)?.split('=')[1];

    const secondRes: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: {
          input: {
            email: adminSettings.email,
            password: adminSettings.password,
          },
        },
      });
    const secondSessionId: string | undefined = parseAdminSessionCookie(secondRes)?.split('=')[1];

    expect(firstSessionId).toBeDefined();
    expect(secondSessionId).toBeDefined();
    expect(secondSessionId).not.toBe(firstSessionId);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].id).toBe(secondSessionId);

    const allSessions: AdminSession[] = await adminAuthTestManager.getAllSessions();
    expect(allSessions).toHaveLength(2);

    const previousSession = allSessions.find((session) => session.id === firstSessionId);
    expect(previousSession?.deletedAt).not.toBeNull();
  });

  it.each([
    {
      title: 'верный email и неверный password',
      credentials: (settings: AdminSettings) => ({
        email: settings.email,
        password: 'wrong-password',
      }),
    },
    {
      title: 'неверный email (валидного формата) и верный password',
      credentials: (settings: AdminSettings) => ({
        email: 'wrong-admin@example.com',
        password: settings.password,
      }),
    },
    {
      title: 'неверные email и password',
      credentials: () => ({
        email: 'wrong-admin@example.com',
        password: 'wrong-password',
      }),
    },
  ])('не должен авторизовать суперадмина при $title (Unauthorized)', async ({ credentials }) => {
    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: { input: credentials(adminSettings) },
      });

    expectUnauthorizedLoginError(res);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(0);
  });

  it.each([
    {
      title: 'email невалидного формата при непустом password',
      input: (settings: AdminSettings) => ({
        email: 'not-an-email',
        password: settings.password,
      }),
      expectedField: 'email',
    },
    {
      title: 'пустой password',
      input: (settings: AdminSettings) => ({
        email: settings.email,
        password: '',
      }),
      expectedField: 'password',
    },
  ])('не должен авторизовать при $title (ValidationError)', async ({ input, expectedField }) => {
    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: { input: input(adminSettings) },
      });

    expectValidationLoginError(res, expectedField);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(0);
  });

  it.each([
    {
      title: 'отсутствует обязательное поле password',
      variables: (settings: AdminSettings) => ({
        input: { email: settings.email },
      }),
    },
    {
      title: 'неверный тип email и password (number вместо String!)',
      variables: () => ({
        input: { email: 123, password: 456 },
      }),
    },
  ])('не должен авторизовать при $title (sanitized GraphQL error)', async ({ variables }) => {
    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: variables(adminSettings),
      });

    expectSanitizedLoginError(res);

    const activeSessions: AdminSession[] = await adminAuthTestManager.getActiveSessions();
    expect(activeSessions).toHaveLength(0);
  });

  it('не должен протекать password в sanitized GraphQL error при неверном типе input', async () => {
    const secretPassword = 'SuperSecretAdminPassword123!';

    const res: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: {
          input: {
            email: 123,
            password: secretPassword,
          },
        },
      });

    expectSanitizedLoginError(res);
    expect(JSON.stringify(res.body.errors)).not.toContain(secretPassword);
  });

  it(`не должен выполнять adminLogin при превышении лимита ${'THROTTLE_LIMIT'} запросов с одного IP`, async () => {
    for (let i = 0; i < throttleLimit; i++) {
      await adminAuthTestManager.login();
    }

    const throttledRes: Response = await request(server)
      .post(ADMIN_GRAPHQL_PATH)
      .send({
        query: ADMIN_LOGIN_MUTATION,
        variables: {
          input: {
            email: adminSettings.email,
            password: adminSettings.password,
          },
        },
      });

    expectThrottledLoginResponse(throttledRes);
  });
});

function parseAdminSessionCookie(res: Response): string | undefined {
  const setCookieHeader: string = res.headers['set-cookie'];

  if (!setCookieHeader) {
    return undefined;
  }

  for (const cookie of setCookieHeader) {
    const match = cookie.match(new RegExp(`${ADMIN_SESSION_COOKIE_NAME}=([^;]+)`));

    if (match?.[1]) {
      return `${ADMIN_SESSION_COOKIE_NAME}=${match[1]}`;
    }
  }

  return undefined;
}

function expectUnauthorizedLoginError(res: Response): void {
  expect(res.status).toBe(HttpStatus.OK);
  expect(res.body.data).toBeNull();
  expect(res.body.errors).toHaveLength(1);

  const error: AdminGraphqlError = res.body.errors[0];
  expect(error.message).toBe('Invalid admin credentials');
  expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.Unauthorized);
  expect(error.extensions.fields).toEqual([]);
  expect(res.headers['set-cookie']).toBeUndefined();
}

function expectValidationLoginError(res: Response, expectedField: string): void {
  expect(res.status).toBe(HttpStatus.OK);
  expect(res.body.data).toBeNull();
  expect(res.body.errors).toHaveLength(1);

  const error: AdminGraphqlError = res.body.errors[0];
  expect(error.message).toBe('Validation failed');
  expect(error.extensions.code).toBe(SnapFlowDomainExceptionCode.ValidationError);
  expect(error.extensions.fields?.length).toBeGreaterThan(0);
  expect(error.extensions.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: expectedField,
        message: expect.any(String),
      }),
    ]),
  );
  expect(res.headers['set-cookie']).toBeUndefined();
}

function expectSanitizedLoginError(res: Response): void {
  expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(res.status);
  expect(res.body.errors.length).toBeGreaterThan(0);

  for (const error of res.body.errors as AdminGraphqlError[]) {
    expect(error.message).toBe('Invalid input');
    expect(SANITIZED_GRAPHQL_ERROR_CODES).toContain(error.extensions.code);
    expect(error.extensions.fields).toBeUndefined();
  }

  expect(res.headers['set-cookie']).toBeUndefined();
}

function expectThrottledLoginResponse(res: Response): void {
  if (res.status === HttpStatus.TOO_MANY_REQUESTS) {
    expect(res.body.errors).toBeUndefined();
    return;
  }

  expect(res.status).toBe(HttpStatus.OK);
  expect(res.body.data).toBeNull();
  expect(res.body.errors).toHaveLength(1);
  expect(res.body.errors[0].extensions?.code).toBe('INTERNAL_SERVER_ERROR');
}
