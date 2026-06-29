import { AppTestManager } from '../managers/app.test-manager';
import { AdminUsersTestManager } from '../managers/admin-users.test-manager';
import { AdminSettings } from '../../src/setup/configuration/admin-settings';
import { Configuration } from '../../src/setup/configuration/configuration';
import { Server } from 'http';
import { ConfigService } from '@nestjs/config';
import { FilesClient } from '../../src/modules/integrations/files/files.client';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import request from 'supertest';
import { AuthTestManager } from '../managers/auth.test-manager';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';

describe('AdminPostsResolver - postCreated() subscription', () => {
  let appTestManager: AppTestManager;
  let adminUsersTestManager: AdminUsersTestManager;
  let authTestManager: AuthTestManager;
  let server: Server;
  let sessionCookie: string;
  let adminSettings: AdminSettings;
  let port: number;
  const POST_CREATED_SUBSCRIPTION = `
subscription {
  postCreated {
    id
    description
    createdAt
    postMedias {
      fileId
      url
      postMediaId
    }
    owner {
      profileId
      userId
      username
      avatarUrl
    }
  }  
}
`;
  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    const app = appTestManager.getApp();
    await app.listen(0);
    server = app.getHttpServer();
    const address = server.address()!;

    port = typeof address === 'string' ? 80 : address.port;

    server = appTestManager.getServer();

    const configService = appTestManager.app.get<ConfigService<Configuration, true>>(ConfigService);

    adminSettings = configService.get<AdminSettings>('adminSettings');

    adminUsersTestManager = new AdminUsersTestManager(appTestManager.prisma, server, adminSettings);

    authTestManager = new AuthTestManager(appTestManager.prisma, server);

    sessionCookie = await adminUsersTestManager.loginAsAdmin();
    await appTestManager.cleanupDb(['_prisma_migrations', 'admin_sessions']);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations', 'admin_sessions']);

    jest.restoreAllMocks();

    jest.spyOn(appTestManager.app.get(FilesClient), 'validateFiles').mockResolvedValue({
      valid: true,
      files: [
        {
          fileId: 'file-1',
          url: 'https://cdn.example.com/file-1.jpg',
          mimeType: 'image/jpeg',
          size: 123,
        },
      ],
    });
  });

  it('должен отправить postCreated после публикации нового поста', async () => {
    const result = await authTestManager.loginAndGetAuthTokens();
    const accessToken = result.accessToken;
    const user = result.createdUser;

    const client = createClient({
      url: `ws://127.0.0.1:${port}/admin/graphql`,

      webSocketImpl: class extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
          super(address, protocols, {
            headers: {
              Cookie: sessionCookie,
            },
          });
        }
      },
    });

    const eventPromise = new Promise<any>((resolve, reject) => {
      client.subscribe(
        {
          query: POST_CREATED_SUBSCRIPTION,
        },
        {
          next: resolve,
          error: (err) => {
            console.dir(err, { depth: null });
            reject(err);
          },
          complete() {},
        },
      );
    });

    const res = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        description: 'Hello',

        fileIds: ['35b3d394-1f39-4370-84ff-a5c60ba4806b'],
      });
    expect(res.statusCode).toBe(201);

    const event = await eventPromise;

    expect(event.data.postCreated).toBeDefined();
    expect(event.data.postCreated.description).toBe('Hello');

    expect(event.data.postCreated.owner.userId).toBe(user.emailConfirmationCode?.userId);
    await client.dispose();
  });
  it('должен вернуть ошибку при подписке без авторизации администратора', async () => {
    const client = createClient({
      url: `ws://127.0.0.1:${port}/admin/graphql`,
      webSocketImpl: WebSocket,
    });

    const result = await new Promise<any>((resolve, reject) => {
      client.subscribe(
        {
          query: POST_CREATED_SUBSCRIPTION,
        },
        {
          next: resolve,
          error: reject,
          complete() {},
        },
      );
    });

    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);

    expect(result.errors[0].message).toBe('Admin is not authenticated');
    expect(result.errors[0].extensions.code).toBe('Unauthorized');

    await client.dispose();
  });
});
