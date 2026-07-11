import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { MessageViewDto } from '../../api/view-dto/message.view-dto';
import { MessengerWebSocketService } from '../services/messenger-websocket.service';

describe('MessengerWebSocketGateway (Integration)', () => {
  let appTestManager: AppTestManager;
  let app: INestApplication;
  let port: number;
  let accessTokenTestHelper: AccessTokenTestHelper;
  let messengerWebSocketService: MessengerWebSocketService;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    app = appTestManager.getApp();
    messengerWebSocketService = app.get(MessengerWebSocketService);

    const apiSettings = app
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);

    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  function createSocket(token?: string): Socket {
    return io(`http://127.0.0.1:${port}/messenger`, {
      transports: ['websocket'],
      auth: token
        ? {
            token,
          }
        : {},
    });
  }

  it('должен подключить пользователя с валидным access token', async () => {
    const token = accessTokenTestHelper.signAccessToken(2);
    const socket = createSocket(token);

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('должен подключить пользователя с валидным access token в формате Bearer', async () => {
    const token = `Bearer ${accessTokenTestHelper.signAccessToken(2)}`;
    const socket = createSocket(token);

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
    const socket = createSocket('invalid-token');

    const error = await new Promise<Error>((resolve) => {
      socket.on('connect_error', resolve);
    });

    expect(error.message).toContain('Unauthorized: Invalid token');
    socket.disconnect();
  });

  it('должен отключить клиента и отправить token.expired при истечении токена', async () => {
    const token = accessTokenTestHelper.signAccessTokenExpiringInSeconds(2, 2);
    const socket = createSocket(token);

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const tokenExpired = new Promise<void>((resolve) => {
      socket.on('token.expired', () => resolve());
    });

    await tokenExpired;

    expect(socket.connected).toBe(false);
    socket.disconnect();
  });

  it('должен доставить message.new в комнату получателя', async () => {
    const token = accessTokenTestHelper.signAccessToken(2);
    const socket = createSocket(token);

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const receivedMessage = new Promise<MessageViewDto>((resolve) => {
      socket.on('message.new', (payload: MessageViewDto) => resolve(payload));
    });

    const payload: MessageViewDto = {
      id: '1',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello via WS',
      createdAt: '2026-07-05T18:00:00.000Z',
    };

    messengerWebSocketService.sendToUser(2, payload);

    await expect(receivedMessage).resolves.toEqual(payload);

    socket.disconnect();
  });
});
