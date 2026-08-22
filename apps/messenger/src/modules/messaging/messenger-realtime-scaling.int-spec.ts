import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { GLOBAL_PREFIX } from '../../../../../libs/common/constants/global-prefix.constant';
import type {
  MessageReadPayload,
  TypingOutboundPayload,
} from '@contracts/messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { AccessTokenTestHelper } from '../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../test/managers/app.test-manager';
import { Configuration } from '../../setup/configuration/configuration';
import { ApiSettings } from '../../setup/configuration/api-settings';
import { MessageViewDto } from './sharing/api/view-dto/message.view-dto';

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

  it('должен доставить message.updated (delivered) отправителю на другом инстансе', async () => {
    const sendResponse = await request(instanceA.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Cross-instance delivered ACK',
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);

    const messageId = sendResponse.body.id as string;

    const senderSocket = createSocket(portA, 1);
    const receiverSocket = createSocket(portB, 2);

    await Promise.all([connectSocket(senderSocket), connectSocket(receiverSocket)]);

    const receivedUpdated = new Promise<MessageViewDto>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('message.updated timeout')), 10_000);

      senderSocket.on(MessengerWsEvent.MessageUpdated, (payload: MessageViewDto) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    receiverSocket.emit(MessengerWsEvent.MessageDelivered, { messageId });

    await expect(receivedUpdated).resolves.toEqual(
      expect.objectContaining({
        id: messageId,
        status: 'delivered',
        text: 'Cross-instance delivered ACK',
      }),
    );

    senderSocket.disconnect();
    receiverSocket.disconnect();
  });

  it('должен доставить message.read отправителю на другом инстансе', async () => {
    const sendResponse = await request(instanceA.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Cross-instance read',
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);

    const chatId = sendResponse.body.chatId as string;
    const messageId = sendResponse.body.id as string;

    const senderSocket = createSocket(portA, 1);
    await connectSocket(senderSocket);

    const receivedRead = new Promise<MessageReadPayload>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('message.read timeout')), 10_000);

      senderSocket.on(MessengerWsEvent.MessageRead, (payload: MessageReadPayload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    await request(instanceB.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/read`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
      .send({ lastReadMessageId: messageId })
      .expect(204);

    await expect(receivedRead).resolves.toEqual(
      expect.objectContaining({
        chatId,
        lastReadMessageId: messageId,
        readByUserId: '2',
        readAt: expect.any(String),
      }),
    );

    senderSocket.disconnect();
  });

  it('должен ретранслировать typing.start/stop peer’у на другом инстансе', async () => {
    const chatId = await createChatViaHttp(1, 2);

    const socketA = createSocket(portA, 1);
    const socketB = createSocket(portB, 2);

    await Promise.all([connectSocket(socketA), connectSocket(socketB)]);

    const receivedStart = new Promise<TypingOutboundPayload>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('typing.start timeout')), 10_000);

      socketB.on(MessengerWsEvent.TypingStart, (payload: TypingOutboundPayload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    socketA.emit(MessengerWsEvent.TypingStart, { chatId });

    await expect(receivedStart).resolves.toEqual({
      chatId,
      userId: '1',
    });

    const receivedStop = new Promise<TypingOutboundPayload>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('typing.stop timeout')), 10_000);

      socketB.on(MessengerWsEvent.TypingStop, (payload: TypingOutboundPayload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

    socketA.emit(MessengerWsEvent.TypingStop, { chatId });

    await expect(receivedStop).resolves.toEqual({
      chatId,
      userId: '1',
    });

    socketA.disconnect();
    socketB.disconnect();
  });
});
