import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'node:net';
import { of, throwError } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { MessageViewDto } from '../../api/view-dto/message.view-dto';
import { MessengerWebSocketService } from '../services/messenger-websocket.service';

function buildToken(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('MessengerWebSocketGateway (Integration)', () => {
  let appTestManager: AppTestManager;
  let app: INestApplication;
  let port: number;
  let httpServiceGetMock: jest.Mock;
  let messengerWebSocketService: MessengerWebSocketService;

  beforeAll(async () => {
    httpServiceGetMock = jest.fn();

    appTestManager = new AppTestManager();
    await appTestManager.init((builder) => {
      builder.overrideProvider(HttpService).useValue({
        get: httpServiceGetMock,
      });
    });

    app = appTestManager.getApp();
    messengerWebSocketService = app.get(MessengerWebSocketService);

    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  beforeEach(() => {
    httpServiceGetMock.mockReset();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  function mockAuthUser(userId: number) {
    httpServiceGetMock.mockImplementation((url: string) => {
      if (url.includes('/auth/me')) {
        return of({ data: { userId: String(userId) } });
      }

      return throwError(() => new Error(`Unexpected URL: ${url}`));
    });
  }

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
    mockAuthUser(2);

    const token = buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
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
    httpServiceGetMock.mockReturnValue(throwError(() => new Error('Unauthorized')));

    const token = buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const socket = createSocket(token);

    const error = await new Promise<Error>((resolve) => {
      socket.on('connect_error', resolve);
    });

    expect(error.message).toContain('Unauthorized: Invalid token');
    socket.disconnect();
  });

  it('должен доставить message.new в комнату получателя', async () => {
    mockAuthUser(2);

    const token = buildToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
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
