import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { Redis } from 'ioredis';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import type {
  ChatUpdatedPayload,
  MessageDeletedPayload,
  MessageReadPayload,
  NewMessagePayload,
  PresenceUpdatedPayload,
  TypingOutboundPayload,
  UnreadUpdatedPayload,
} from '@contracts/messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { DeleteMessageScope } from '../../messages/api/input-dto/delete-message.query-dto';
import { MessageViewDto } from '../../messages/api/view-dto/message.view-dto';
import { MessengerWebSocketService } from '../services/messenger-websocket.service';

describe('MessengerWebSocketGateway (Integration)', () => {
  let appTestManager: AppTestManager;
  let app: INestApplication;
  let port: number;
  let accessTokenTestHelper: AccessTokenTestHelper;
  let messengerWebSocketService: MessengerWebSocketService;
  let redis: Redis;

  async function cleanupPresenceRedis(): Promise<void> {
    const keys = await redis.keys('presence:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    app = appTestManager.getApp();
    messengerWebSocketService = app.get(MessengerWebSocketService);
    redis = app.get(REDIS_CLIENT_INJECT_TOKEN);

    if (redis.status === 'wait') {
      await redis.connect();
    }

    const apiSettings = app.get(ConfigService<Configuration, true>).get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);

    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    await cleanupPresenceRedis();
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

  async function connectSocket(socket: Socket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
  }

  async function disconnectSocket(socket: Socket): Promise<void> {
    if (!socket.connected) {
      socket.removeAllListeners();
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once('disconnect', () => resolve());
      socket.disconnect();
    });
    socket.removeAllListeners();
    // server-side PresenceDisconnectUseCase (Redis) после client disconnect
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  async function waitForPresenceUpdated(
    socket: Socket,
    predicate?: (payload: PresenceUpdatedPayload) => boolean,
  ): Promise<PresenceUpdatedPayload> {
    return new Promise((resolve) => {
      const handler = (payload: PresenceUpdatedPayload) => {
        if (predicate && !predicate(payload)) {
          return;
        }
        socket.off(MessengerWsEvent.PresenceUpdated, handler);
        resolve(payload);
      };
      socket.on(MessengerWsEvent.PresenceUpdated, handler);
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

    const receivedMessage = new Promise<NewMessagePayload>((resolve) => {
      socket.on(MessengerWsEvent.MessageNew, (payload: NewMessagePayload) => resolve(payload));
    });

    const payload: NewMessagePayload = {
      id: '1',
      chatId: '10',
      senderId: '1',
      receiverId: '2',
      text: 'Hello via WS',
      clientMessageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      createdAt: '2026-07-05T18:00:00.000Z',
      status: null,
      editedAt: null,
      deletedAt: null,
      deletedForEveryone: false,
      replyTo: null,
    };

    messengerWebSocketService.sendToUser(2, payload);

    await expect(receivedMessage).resolves.toEqual(payload);

    socket.disconnect();
  });

  it('должен доставить chat.updated и unread.updated получателю при новом сообщении', async () => {
    const receiverToken = accessTokenTestHelper.signAccessToken(2);
    const socket = createSocket(receiverToken);

    await connectSocket(socket);

    const receivedChatUpdated = new Promise<ChatUpdatedPayload>((resolve) => {
      socket.on(MessengerWsEvent.ChatUpdated, (payload: ChatUpdatedPayload) => resolve(payload));
    });
    const receivedUnreadUpdated = new Promise<UnreadUpdatedPayload>((resolve) => {
      socket.on(MessengerWsEvent.UnreadUpdated, (payload: UnreadUpdatedPayload) =>
        resolve(payload),
      );
    });
    const receivedMessageNew = new Promise<NewMessagePayload>((resolve) => {
      socket.on(MessengerWsEvent.MessageNew, (payload: NewMessagePayload) => resolve(payload));
    });

    const response = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Hello with badges',
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);

    await expect(receivedMessageNew).resolves.toEqual(
      expect.objectContaining({
        id: response.body.id,
        chatId: response.body.chatId,
        senderId: '1',
        receiverId: '2',
        text: 'Hello with badges',
      }),
    );
    await expect(receivedChatUpdated).resolves.toEqual({
      chatId: response.body.chatId,
      unreadCount: 1,
    });
    await expect(receivedUnreadUpdated).resolves.toEqual({
      total: 1,
    });

    await disconnectSocket(socket);
  });

  it('должен доставить message.read в комнату получателя через emitToUser', async () => {
    const token = accessTokenTestHelper.signAccessToken(2);
    const socket = createSocket(token);

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const receivedPayload = new Promise<{
      chatId: string;
      lastReadMessageId: string;
      readByUserId: string;
      readAt: string;
    }>((resolve) => {
      socket.on(MessengerWsEvent.MessageRead, (payload) => resolve(payload));
    });

    const payload = {
      chatId: '10',
      lastReadMessageId: '100',
      readByUserId: '1',
      readAt: '2026-07-05T18:05:00.000Z',
    };

    messengerWebSocketService.emitToUser(2, MessengerWsEvent.MessageRead, payload);

    await expect(receivedPayload).resolves.toEqual(payload);

    socket.disconnect();
  });

  it('должен обработать message.delivered и отправить отправителю message.updated со status=delivered', async () => {
    const senderToken = accessTokenTestHelper.signAccessToken(1);
    const receiverToken = accessTokenTestHelper.signAccessToken(2);

    const createResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: '2',
        text: 'Hello via delivery ACK',
        clientMessageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      })
      .expect(201);

    const messageId = createResponse.body.id as string;

    const senderSocket = createSocket(senderToken);
    const receiverSocket = createSocket(receiverToken);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        senderSocket.on('connect', () => resolve());
        senderSocket.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        receiverSocket.on('connect', () => resolve());
        receiverSocket.on('connect_error', reject);
      }),
    ]);

    const receivedUpdated = new Promise<MessageViewDto>((resolve) => {
      senderSocket.on(MessengerWsEvent.MessageUpdated, (payload: MessageViewDto) =>
        resolve(payload),
      );
    });

    receiverSocket.emit(MessengerWsEvent.MessageDelivered, { messageId });

    await expect(receivedUpdated).resolves.toEqual(
      expect.objectContaining({
        id: messageId,
        chatId: createResponse.body.chatId,
        senderId: '1',
        receiverId: '2',
        text: 'Hello via delivery ACK',
        status: 'delivered',
      }),
    );

    const delivery = await appTestManager.prisma.messageDelivery.findUnique({
      where: {
        messageId_userId: {
          messageId: Number(messageId),
          userId: 2,
        },
      },
    });

    expect(delivery).toEqual(
      expect.objectContaining({
        messageId: Number(messageId),
        userId: 2,
        deliveredAt: expect.any(Date),
      }),
    );

    senderSocket.disconnect();
    receiverSocket.disconnect();
  });

  it('должен ретранслировать typing.start/stop peer’у и держать ключ в Redis с TTL', async () => {
    const userAToken = accessTokenTestHelper.signAccessToken(1);
    const userBToken = accessTokenTestHelper.signAccessToken(2);

    const chatResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const chatId = chatResponse.body.id as string;

    const socketA = createSocket(userAToken);
    const socketB = createSocket(userBToken);

    await Promise.all([connectSocket(socketA), connectSocket(socketB)]);

    const receivedStart = new Promise<TypingOutboundPayload>((resolve) => {
      socketB.on(MessengerWsEvent.TypingStart, (payload: TypingOutboundPayload) =>
        resolve(payload),
      );
    });

    socketA.emit(MessengerWsEvent.TypingStart, { chatId });

    await expect(receivedStart).resolves.toEqual({
      chatId,
      userId: '1',
    });

    const typingKey = `typing:${chatId}:1`;
    await expect(redis.get(typingKey)).resolves.toBe('1');
    const ttl = await redis.ttl(typingKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3);

    const receivedStop = new Promise<TypingOutboundPayload>((resolve) => {
      socketB.on(MessengerWsEvent.TypingStop, (payload: TypingOutboundPayload) => resolve(payload));
    });

    socketA.emit(MessengerWsEvent.TypingStop, { chatId });

    await expect(receivedStop).resolves.toEqual({
      chatId,
      userId: '1',
    });

    await expect(redis.exists(typingKey)).resolves.toBe(0);

    socketA.disconnect();
    socketB.disconnect();
  });

  it('mark-read: отправитель получает message.read, в history status=read', async () => {
    const senderToken = accessTokenTestHelper.signAccessToken(1);
    const receiverToken = accessTokenTestHelper.signAccessToken(2);

    const sendResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: '2',
        text: 'Please read me',
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);

    const chatId = sendResponse.body.chatId as string;
    const messageId = sendResponse.body.id as string;

    const senderSocket = createSocket(senderToken);
    await connectSocket(senderSocket);

    const receivedRead = new Promise<MessageReadPayload>((resolve) => {
      senderSocket.on(MessengerWsEvent.MessageRead, (payload: MessageReadPayload) =>
        resolve(payload),
      );
    });

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/read`)
      .set('Authorization', `Bearer ${receiverToken}`)
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

    const historyResponse = await request(appTestManager.getServer())
      .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${senderToken}`)
      .expect(200);

    expect(historyResponse.body.items[0]).toEqual(
      expect.objectContaining({
        id: messageId,
        status: 'read',
      }),
    );

    senderSocket.disconnect();
  });

  it('edit: peer получает message.updated в realtime', async () => {
    const authorToken = accessTokenTestHelper.signAccessToken(1);
    const peerToken = accessTokenTestHelper.signAccessToken(2);

    const createChatResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const chatId = Number(createChatResponse.body.id);

    const message = await appTestManager.prisma.message.create({
      data: {
        chatId,
        senderId: 1,
        text: 'Original',
        clientMessageId: crypto.randomUUID(),
      },
    });

    const peerSocket = createSocket(peerToken);
    await connectSocket(peerSocket);

    const receivedUpdated = new Promise<MessageViewDto>((resolve) => {
      peerSocket.on(MessengerWsEvent.MessageUpdated, (payload: MessageViewDto) => resolve(payload));
    });

    await request(appTestManager.getServer())
      .patch(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ text: 'Edited live' })
      .expect(200);

    await expect(receivedUpdated).resolves.toEqual(
      expect.objectContaining({
        id: String(message.id),
        chatId: String(chatId),
        text: 'Edited live',
        editedAt: expect.any(String),
        status: null,
      }),
    );

    peerSocket.disconnect();
  });

  it('delete everyone: peer получает message.deleted в realtime', async () => {
    const authorToken = accessTokenTestHelper.signAccessToken(1);
    const peerToken = accessTokenTestHelper.signAccessToken(2);

    const createChatResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const chatId = Number(createChatResponse.body.id);

    const message = await appTestManager.prisma.message.create({
      data: {
        chatId,
        senderId: 1,
        text: 'Will be deleted',
        clientMessageId: crypto.randomUUID(),
      },
    });

    const peerSocket = createSocket(peerToken);
    await connectSocket(peerSocket);

    const receivedDeleted = new Promise<MessageDeletedPayload>((resolve) => {
      peerSocket.on(MessengerWsEvent.MessageDeleted, (payload: MessageDeletedPayload) =>
        resolve(payload),
      );
    });

    await request(appTestManager.getServer())
      .delete(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
      .query({ scope: DeleteMessageScope.Everyone })
      .set('Authorization', `Bearer ${authorToken}`)
      .expect(204);

    await expect(receivedDeleted).resolves.toEqual({
      messageId: String(message.id),
      chatId: String(chatId),
      scope: DeleteMessageScope.Everyone,
    });

    peerSocket.disconnect();
  });

  it('connect: peer получает presence.updated online, GET /presence отражает online', async () => {
    const userAToken = accessTokenTestHelper.signAccessToken(1);
    const userBToken = accessTokenTestHelper.signAccessToken(2);

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const socketB = createSocket(userBToken);
    await connectSocket(socketB);

    const receivedOnline = waitForPresenceUpdated(
      socketB,
      (payload) => payload.userId === '1' && payload.online === true,
    );

    const socketA = createSocket(userAToken);
    await connectSocket(socketA);

    await expect(receivedOnline).resolves.toEqual({
      userId: '1',
      online: true,
      lastSeenAt: null,
    });

    const presenceResponse = await request(appTestManager.getServer())
      .get(`/${GLOBAL_PREFIX}/messenger/presence`)
      .query({ userIds: '1' })
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(presenceResponse.body).toEqual([{ userId: '1', online: true, lastSeenAt: null }]);

    await expect(redis.zcard('presence:1')).resolves.toBeGreaterThan(0);

    await redis.expire('presence:1', 5);
    expect(await redis.ttl('presence:1')).toBeLessThanOrEqual(5);

    socketA.emit(MessengerWsEvent.PresenceHeartbeat);

    await expect(
      new Promise<number>((resolve, reject) => {
        const startedAt = Date.now();
        const poll = async () => {
          const ttl = await redis.ttl('presence:1');
          if (ttl > 5) {
            resolve(ttl);
            return;
          }
          if (Date.now() - startedAt > 2000) {
            reject(new Error(`TTL not refreshed, last ttl=${ttl}`));
            return;
          }
          setTimeout(() => {
            void poll();
          }, 50);
        };
        void poll();
      }),
    ).resolves.toBeGreaterThan(5);

    await disconnectSocket(socketA);
    await disconnectSocket(socketB);
  });

  it('disconnect: peer получает presence.updated offline и обновляется lastSeenAt', async () => {
    const userAToken = accessTokenTestHelper.signAccessToken(1);
    const userBToken = accessTokenTestHelper.signAccessToken(2);

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const socketB = createSocket(userBToken);
    await connectSocket(socketB);

    const receivedOnline = waitForPresenceUpdated(
      socketB,
      (payload) => payload.userId === '1' && payload.online === true,
    );

    const socketA = createSocket(userAToken);
    await connectSocket(socketA);
    await receivedOnline;

    const receivedOffline = waitForPresenceUpdated(
      socketB,
      (payload) => payload.userId === '1' && payload.online === false,
    );

    socketA.disconnect();

    const offlinePayload = await receivedOffline;
    expect(offlinePayload).toEqual({
      userId: '1',
      online: false,
      lastSeenAt: expect.any(String),
    });
    expect(Date.parse(offlinePayload.lastSeenAt!)).not.toBeNaN();

    const settings = await appTestManager.prisma.userPresenceSettings.findUnique({
      where: { userId: 1 },
    });
    expect(settings?.lastSeenAt).toEqual(expect.any(Date));

    const presenceResponse = await request(appTestManager.getServer())
      .get(`/${GLOBAL_PREFIX}/messenger/presence`)
      .query({ userIds: '1' })
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(presenceResponse.body).toEqual([
      {
        userId: '1',
        online: false,
        lastSeenAt: settings!.lastSeenAt!.toISOString(),
      },
    ]);

    await disconnectSocket(socketB);
  });

  it('приватность: скрытая активность не транслирует presence.updated', async () => {
    const userAToken = accessTokenTestHelper.signAccessToken(1);
    const userBToken = accessTokenTestHelper.signAccessToken(2);

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    await request(appTestManager.getServer())
      .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ showActivityStatus: false })
      .expect(204);

    const socketB = createSocket(userBToken);
    await connectSocket(socketB);

    let receivedFromA = false;
    socketB.on(MessengerWsEvent.PresenceUpdated, (payload: PresenceUpdatedPayload) => {
      if (payload.userId === '1') {
        receivedFromA = true;
      }
    });

    const socketA = createSocket(userAToken);
    await connectSocket(socketA);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(receivedFromA).toBe(false);

    const presenceResponse = await request(appTestManager.getServer())
      .get(`/${GLOBAL_PREFIX}/messenger/presence`)
      .query({ userIds: '1' })
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(200);

    expect(presenceResponse.body).toEqual([{ userId: '1', online: false, lastSeenAt: null }]);

    await disconnectSocket(socketA);
    await disconnectSocket(socketB);
  });

  it('PATCH activity-status=false: peer получает скрытие статуса', async () => {
    const userAToken = accessTokenTestHelper.signAccessToken(1);
    const userBToken = accessTokenTestHelper.signAccessToken(2);

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const socketB = createSocket(userBToken);
    await connectSocket(socketB);

    const receivedOnline = waitForPresenceUpdated(
      socketB,
      (payload) => payload.userId === '1' && payload.online === true,
    );

    const socketA = createSocket(userAToken);
    await connectSocket(socketA);
    await receivedOnline;

    const receivedHidden = waitForPresenceUpdated(
      socketB,
      (payload) =>
        payload.userId === '1' && payload.online === false && payload.lastSeenAt === null,
    );

    await request(appTestManager.getServer())
      .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ showActivityStatus: false })
      .expect(204);

    await expect(receivedHidden).resolves.toEqual({
      userId: '1',
      online: false,
      lastSeenAt: null,
    });

    await disconnectSocket(socketA);
    await disconnectSocket(socketB);
  });
});
