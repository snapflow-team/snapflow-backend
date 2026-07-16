import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { GLOBAL_PREFIX } from '../../../../../libs/common/constants/global-prefix.constant';
import { MessengerWsEvent } from '../../../../../libs/contracts/messenger';
import { AccessTokenTestHelper } from '../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../test/managers/app.test-manager';
import { Configuration } from '../../setup/configuration/configuration';
import { ApiSettings } from '../../setup/configuration/api-settings';
import { MessageViewDto } from './api/view-dto/message.view-dto';

describe('Messenger realtime scaling (Integration)', () => {
  let instanceA: AppTestManager;
  let instanceB: AppTestManager;
  let portA: number;
  let portB: number;
  let accessTokenTestHelper: AccessTokenTestHelper;

  jest.setTimeout(30_000);

  beforeAll(async () => {
    instanceA = new AppTestManager();
    instanceB = new AppTestManager();

    await instanceA.initWithRedisWebSocketAdapter();
    await instanceB.initWithRedisWebSocketAdapter();

    await instanceA.getApp().listen(0);
    await instanceB.getApp().listen(0);

    portA = (instanceA.getServer().address() as AddressInfo).port;
    portB = (instanceB.getServer().address() as AddressInfo).port;

    const apiSettings = instanceA
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);
  });

  beforeEach(async () => {
    await instanceA.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await instanceA.close();
    await instanceB.close();
  });

  function createSocket(port: number, userId: number): Socket {
    return io(`http://127.0.0.1:${port}/messenger`, {
      transports: ['websocket'],
      auth: {
        token: accessTokenTestHelper.signAccessToken(userId),
      },
    });
  }

  async function connectSocket(socket: Socket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
  }

  async function createChatViaHttp(userId: number, interlocutorId: number): Promise<string> {
    const response = await request(instanceA.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(userId)}`)
      .send({ interlocutorId: String(interlocutorId) })
      .expect(200);

    return response.body.id;
  }

  it('должен доставить message.new получателю на другом инстансе через Redis-adapter', async () => {
    await createChatViaHttp(1, 2);

    const receiverSocket = createSocket(portB, 2);
    await connectSocket(receiverSocket);

    const receivedMessage = new Promise<MessageViewDto>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('message.new timeout')), 10_000);

      receiverSocket.on(MessengerWsEvent.MessageNew, (payload: MessageViewDto) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    const clientMessageId = crypto.randomUUID();

    const sendResponse = await request(instanceA.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Cross-instance delivery',
        clientMessageId,
      })
      .expect(201);

    await expect(receivedMessage).resolves.toEqual(
      expect.objectContaining({
        id: sendResponse.body.id,
        chatId: sendResponse.body.chatId,
        senderId: '1',
        receiverId: '2',
        text: 'Cross-instance delivery',
        clientMessageId,
      }),
    );

    receiverSocket.disconnect();
  });

  it('должен догнать сообщения отправленные offline после reconnect через cursor-пагинацию', async () => {
    const chatId = await createChatViaHttp(1, 2);

    const baselineClientMessageId = crypto.randomUUID();
    const baselineResponse = await request(instanceA.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'baseline',
        clientMessageId: baselineClientMessageId,
      })
      .expect(201);

    const receiverSocket = createSocket(portB, 2);
    await connectSocket(receiverSocket);
    receiverSocket.disconnect();

    const offlineMessages: MessageViewDto[] = [];

    for (let i = 1; i <= 3; i++) {
      const response = await request(instanceA.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({
          receiverId: '2',
          text: `offline-${i}`,
          clientMessageId: crypto.randomUUID(),
        })
        .expect(201);

      offlineMessages.push(response.body);
    }

    const reconnectedSocket = createSocket(portB, 2);
    await connectSocket(reconnectedSocket);
    reconnectedSocket.disconnect();

    const collectedIds: string[] = [];
    let cursor: string | null = null;

    do {
      const response = await request(instanceB.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      const pageIds = response.body.items.map((item: { id: string }) => item.id);
      expect(pageIds).toEqual([...new Set(pageIds)]);
      collectedIds.push(...pageIds);

      cursor = response.body.nextCursor;
    } while (cursor);

    const expectedIds = [
      ...[...offlineMessages].reverse().map((message) => message.id),
      baselineResponse.body.id,
    ];

    expect(collectedIds).toHaveLength(4);
    expect(collectedIds).toEqual([...new Set(collectedIds)]);
    expect(collectedIds).toEqual(expectedIds);
  });
});
