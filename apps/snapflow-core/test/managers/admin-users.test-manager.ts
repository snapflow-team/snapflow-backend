import { User, UserProfile } from '@generated/prisma-snapflow';
import { Response } from 'supertest';
import { Server } from 'http';
import { PrismaService } from '../../src/database/prisma.service';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { AdminAuthTestManager } from './admin-auth.test-manager';

export class AdminUsersTestManager {
  private readonly adminAuthTestManager: AdminAuthTestManager;

  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
    adminSettings: AdminSettings,
  ) {
    this.adminAuthTestManager = new AdminAuthTestManager(prisma, server, adminSettings);
  }

  async loginAsAdmin(): Promise<string> {
    const { sessionCookie } = await this.adminAuthTestManager.login();
    if (!sessionCookie) {
      throw new Error('Admin login did not return session cookie');
    }
    return sessionCookie;
  }

  async gql(
    query: string,
    variables?: Record<string, unknown>,
    cookie?: string,
  ): Promise<Response> {
    return this.adminAuthTestManager.gql(query, variables, cookie);
  }

  async createUser(options?: {
    username?: string;
    email?: string;
    createdAt?: Date;
    avatarUrl?: string;
    deletedAt?: Date | null;
  }): Promise<User & { profile?: UserProfile | null }> {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const username = options?.username ?? `user_${suffix}`;
    const email = options?.email ?? `${username}@example.com`;

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: 'hashed_password',
        createdAt: options?.createdAt,
        deletedAt: options?.deletedAt ?? null,
        ...(options?.avatarUrl && {
          profiles: {
            create: {
              avatarUrl: options.avatarUrl,
            },
          },
        }),
      },
      include: {
        profiles: true,
      },
    });

    return { ...user, profile: user.profiles[0] ?? null };
  }
}
