import { AuthTestManager } from '../../../../../test/managers/auth.test-manager';
import { INestApplication } from '@nestjs/common';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../../user-accounts/auth/constants/auth.constants';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenService } from '../../../user-accounts/auth/application/services/auth-token.service';
import { AuthTokenTestService } from '../../../../../test/helpers/jwt-custom.helper';

describe('NotificationGateway', () => {
  let appTestManager: AppTestManager;
  let authTestManager: AuthTestManager;

  let app: INestApplication;
  let port: number;
  let jwtTestHelper: AuthTokenTestService;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((builder) => {
      builder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useValue({
        provide: ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
        useFactory: (): JwtService => {
          return new JwtService({
            secret: 'secret',
            signOptions: {
              expiresIn: '1m',
            },
          });
        },
      });
      builder.overrideProvider(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: () => {
          return new JwtService({
            secret: 'secret',
            signOptions: {
              expiresIn: '1m',
            },
          });
        },
      });
      builder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: () => {
          return new JwtService({
            secret: 'secret',
            signOptions: {
              expiresIn: '1m',
            },
          });
        },
      });
      builder.overrideProvider(AuthTokenService).useClass(AuthTokenTestService);
    });

    app = appTestManager.getApp();

    await app.listen(0);

    port = (app.getHttpServer().address() as AddressInfo).port;

    authTestManager = new AuthTestManager(appTestManager.prisma, app.getHttpServer());
    jwtTestHelper = app.get(AuthTokenService);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  function createSocket(token?: string): Socket {
    return io(`http://127.0.0.1:${port}/notifications`, {
      transports: ['websocket'],
      auth: token
        ? {
            token,
          }
        : {},
    });
  }

  it('должен подключить пользователя с валидным access token', async () => {
    const { accessToken } = await authTestManager.loginAndGetAuthTokens();

    const socket = createSocket(accessToken);

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());

      socket.on('connect_error', reject);
    });

    expect(socket.connected).toBe(true);

    socket.disconnect();
  });

  it('должен отклонить подключение без access token', async () => {
    const socket = createSocket();

    const error = await new Promise<Error>((resolve) => {
      socket.on('connect_error', resolve);
    });

    expect(error.message).toContain('Unauthorized: No token provided');

    socket.disconnect();
  });

  it('должен отклонить подключение с невалидным access token', async () => {
    const socket = createSocket('invalid.jwt.token');

    const error = await new Promise<Error>((resolve) => {
      socket.on('connect_error', resolve);
    });

    expect(error.message).toContain('Unauthorized: Invalid token');

    socket.disconnect();
  });

  it('должен сразу отключить пользователя с истекшим access token', async () => {
    const expiredToken = jwtTestHelper.generateExpiredAccessToken(1);

    const socket = createSocket(expiredToken);

    await new Promise<void>((resolve) => {
      socket.on('disconnect', () => resolve());

      socket.on('connect_error', () => resolve());
    });

    expect(socket.connected).toBe(false);

    socket.disconnect();
  });

  it('должен отправить token.expired и отключить клиента после истечения access token', async () => {
    const shortLivingToken = jwtTestHelper.generateAccessTokenLives2s(1);

    const socket = createSocket(shortLivingToken);

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', resolve);

      socket.on('connect_error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('token.expired', () => resolve());

      socket.on('disconnect', () => {
        /**
         * disconnect может прийти раньше события,
         * если таймер очень маленький.
         */
      });

      setTimeout(() => {
        reject(new Error('token.expired was not emitted'));
      }, 5000);
    });

    await new Promise<void>((resolve) => {
      if (!socket.connected) {
        return resolve();
      }

      socket.on('disconnect', () => resolve());
    });

    expect(socket.connected).toBe(false);

    socket.disconnect();
  });
});
