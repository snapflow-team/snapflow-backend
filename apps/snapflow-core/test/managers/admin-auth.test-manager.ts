import { AdminSession } from '@generated/prisma-snapflow';
import request, { Response } from 'supertest';
import { Server } from 'http';
import { PrismaService } from '../../src/database/prisma.service';
import { ADMIN_GRAPHQL_PATH } from '../../src/setup/admin-graphql.module-options';
import { ADMIN_SESSION_COOKIE_NAME } from '../../src/modules/admin/constants/admin-auth.constants';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';

const ADMIN_LOGIN_MUTATION = `
  mutation AdminLogin($input: AdminLoginInput!) {
    adminLogin(input: $input) {
      success
    }
  }
`;

export type AdminLoginCredentials = {
  email: string;
  password: string;
};

export type AdminAuthLoginResult = {
  res: Response;
  sessionCookie: string | undefined;
};

export type SeedAdminSessionOptions = {
  expiresAt: Date;
  deletedAt?: Date | null;
};

/**
 * Менеджер для e2e-тестирования admin GraphQL авторизации (login/logout).
 */
export class AdminAuthTestManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
    private readonly adminSettings: AdminSettings,
  ) {}

  async gql(
    query: string,
    variables?: Record<string, unknown>,
    cookie?: string,
  ): Promise<Response> {
    const req = request(this.server).post(ADMIN_GRAPHQL_PATH).send({ query, variables });

    if (cookie) {
      req.set('Cookie', cookie);
    }

    return req;
  }

  async login(credentials?: AdminLoginCredentials): Promise<AdminAuthLoginResult> {
    const input: AdminLoginCredentials = credentials ?? {
      email: this.adminSettings.email,
      password: this.adminSettings.password,
    };

    const res = await this.gql(ADMIN_LOGIN_MUTATION, { input });

    return {
      res,
      sessionCookie: this.parseSessionCookie(res),
    };
  }

  async getActiveSessions(): Promise<AdminSession[]> {
    return this.prisma.adminSession.findMany({
      where: {
        deletedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async getAllSessions(): Promise<AdminSession[]> {
    return this.prisma.adminSession.findMany();
  }

  async seedSession(options: SeedAdminSessionOptions): Promise<AdminSession> {
    return this.prisma.adminSession.create({
      data: {
        id: crypto.randomUUID(),
        deviceName: 'Test Device',
        ip: '127.0.0.1',
        expiresAt: options.expiresAt,
        deletedAt: options.deletedAt ?? null,
      },
    });
  }

  private parseSessionCookie(res: Response): string | undefined {
    const setCookieHeader = res.headers['set-cookie'];

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
}
