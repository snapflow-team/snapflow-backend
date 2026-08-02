import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../libs/common/constants/global-prefix.constant';
import { MessengerWsEvent } from '../../../../../../libs/contracts/messenger';
import { DeleteMessageScope } from './input-dto/delete-message.query-dto';
import { AccessTokenTestHelper } from '../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../test/managers/app.test-manager';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { MessengerWebSocketService } from '../websocket/services/messenger-websocket.service';

describe('MessagingController (Integration)', () => {
  let appTestManager: AppTestManager;
  let accessTokenTestHelper: AccessTokenTestHelper;
  let redis: Redis;

  const clientMessageId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  async function cleanupPresenceRedis(): Promise<void> {
    const keys = await redis.keys('presence:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    redis = appTestManager.getApp().get(REDIS_CLIENT_INJECT_TOKEN);
    if (redis.status === 'wait') {
      await redis.connect();
    }

    const apiSettings = appTestManager
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    await cleanupPresenceRedis();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть 201 и созданное сообщение при валидном запросе', async () => {
    const response = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '1',
        chatId: '1',
        senderId: '1',
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
        createdAt: expect.any(String),
      }),
    );

    const messageCount = await appTestManager.prisma.message.count();
    const chatCount = await appTestManager.prisma.chat.count();
    const chat = await appTestManager.prisma.chat.findFirst();

    expect(messageCount).toBe(1);
    expect(chatCount).toBe(1);
    expect(chat).toEqual(
      expect.objectContaining({
        lastMessageId: 1,
        lastMessageAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
  });

  it('должен идемпотентно возвращать то же сообщение при повторном POST с тем же clientMessageId', async () => {
    const payload = {
      receiverId: '2',
      text: 'Hello!',
      clientMessageId,
    };

    const sendToUserSpy = jest.spyOn(
      appTestManager.getApp().get(MessengerWebSocketService),
      'sendToUser',
    );

    const firstResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send(payload)
      .expect(201);

    const secondResponse = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send(payload)
      .expect(201);

    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(await appTestManager.prisma.message.count()).toBe(1);
    expect(sendToUserSpy).toHaveBeenCalledTimes(1);

    sendToUserSpy.mockRestore();
  });

  it('должен вернуть 400 при отсутствии clientMessageId', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Hello!',
      })
      .expect(400);

    expect(await appTestManager.prisma.message.count()).toBe(0);
  });

  it('должен вернуть 400 при невалидном clientMessageId', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Hello!',
        clientMessageId: 'not-a-uuid',
      })
      .expect(400);

    expect(await appTestManager.prisma.message.count()).toBe(0);
  });

  it('должен вернуть 400 при replyToMessageId из другого чата', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({ interlocutorId: '2' })
      .expect(200);

    const otherChat = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/chats`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({ interlocutorId: '3' })
      .expect(200);

    const foreignMessage = await appTestManager.prisma.message.create({
      data: {
        chatId: Number(otherChat.body.id),
        senderId: 3,
        text: 'foreign',
        clientMessageId: crypto.randomUUID(),
      },
    });

    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Reply',
        clientMessageId: crypto.randomUUID(),
        replyToMessageId: String(foreignMessage.id),
      })
      .expect(400);

    expect(await appTestManager.prisma.message.count()).toBe(1);
  });

  it('должен вернуть 400 при пустом или пробельном тексте сообщения', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: '   ',
        clientMessageId,
      })
      .expect(400);

    const messageCount = await appTestManager.prisma.message.count();
    expect(messageCount).toBe(0);
  });

  it('должен вернуть 401 без authorization header', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .send({
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
      })
      .expect(401);
  });

  it('должен вернуть 401 при невалидном токене', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', 'Bearer invalid-token')
      .send({
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
      })
      .expect(401);
  });

  it('должен вернуть 401 при истёкшем access token', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signExpiredAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
      })
      .expect(401);
  });

  describe('GET /messenger/chats', () => {
    async function seedChatWithLastMessage(
      participantAId: number,
      participantBId: number,
      lastMessageAt: Date,
      text: string,
    ): Promise<number> {
      const [normalizedA, normalizedB] =
        participantAId < participantBId
          ? [participantAId, participantBId]
          : [participantBId, participantAId];

      const chat = await appTestManager.prisma.chat.create({
        data: {
          participantAId: normalizedA,
          participantBId: normalizedB,
        },
      });

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: chat.id,
          senderId: participantBId,
          text,
          clientMessageId: crypto.randomUUID(),
          createdAt: lastMessageAt,
        },
      });

      await appTestManager.prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessageId: message.id,
          lastMessageAt,
        },
      });

      return chat.id;
    }

    it('должен вернуть чаты, отсортированные по последнему сообщению (desc)', async () => {
      const oldest = new Date('2026-07-01T10:00:00.000Z');
      const middle = new Date('2026-07-02T10:00:00.000Z');
      const newest = new Date('2026-07-03T10:00:00.000Z');

      const chatWithOldestMessage = await seedChatWithLastMessage(1, 2, oldest, 'oldest');
      const chatWithNewestMessage = await seedChatWithLastMessage(1, 3, newest, 'newest');
      const chatWithMiddleMessage = await seedChatWithLastMessage(1, 4, middle, 'middle');

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body.items).toHaveLength(3);
      expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
        String(chatWithNewestMessage),
        String(chatWithMiddleMessage),
        String(chatWithOldestMessage),
      ]);
      expect(response.body.hasMore).toBe(false);
      expect(response.body.nextCursor).toBeNull();
    });

    it('должен вернуть все чаты по cursor без пропусков и дубликатов', async () => {
      const baseDate = new Date('2026-07-01T10:00:00.000Z');
      const chatIds: number[] = [];

      for (let i = 0; i < 5; i++) {
        const lastMessageAt = new Date(baseDate.getTime() + i * 60_000);
        chatIds.push(await seedChatWithLastMessage(1, 10 + i, lastMessageAt, `chat-${i}`));
      }

      const collectedIds: string[] = [];
      let cursor: string | null = null;

      do {
        const response = await request(appTestManager.getServer())
          .get(`/${GLOBAL_PREFIX}/messenger/chats`)
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
          .expect(200);

        const pageIds = response.body.items.map((item: { id: string }) => item.id);
        expect(pageIds).toEqual([...new Set(pageIds)]);
        collectedIds.push(...pageIds);

        cursor = response.body.nextCursor;
      } while (cursor);

      expect(collectedIds).toHaveLength(5);
      expect(collectedIds).toEqual([...new Set(collectedIds)]);
      expect(collectedIds).toEqual(
        [...chatIds].sort((a, b) => b - a).map(String),
      );
    });
  });

  describe('GET /messenger/chats/:chatId/messages', () => {
    it('должен вернуть историю по cursor без пропусков и дубликатов', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = createChatResponse.body.id;
      const sameCreatedAt = new Date('2026-07-05T18:00:00.000Z');
      const expectedIds: number[] = [];

      for (let i = 1; i <= 7; i++) {
        const message = await appTestManager.prisma.message.create({
          data: {
            chatId: Number(chatId),
            senderId: i % 2 === 0 ? 2 : 1,
            text: `message-${i}`,
            clientMessageId: crypto.randomUUID(),
            createdAt: sameCreatedAt,
          },
        });
        expectedIds.push(message.id);
      }

      const lastMessageId = Math.max(...expectedIds);
      await appTestManager.prisma.chat.update({
        where: { id: Number(chatId) },
        data: {
          lastMessageId,
          lastMessageAt: sameCreatedAt,
        },
      });

      const collectedIds: string[] = [];
      let cursor: string | null = null;

      do {
        const response = await request(appTestManager.getServer())
          .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
          .query({ limit: 3, ...(cursor ? { cursor } : {}) })
          .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
          .expect(200);

        const pageIds = response.body.items.map((item: { id: string }) => item.id);
        expect(pageIds).toEqual([...new Set(pageIds)]);
        collectedIds.push(...pageIds);

        cursor = response.body.nextCursor;
      } while (cursor);

      expect(collectedIds).toHaveLength(7);
      expect(collectedIds).toEqual([...new Set(collectedIds)]);
      expect(collectedIds.map(Number)).toEqual(
        [...expectedIds].sort((a, b) => b - a),
      );
    });

    it('должен возвращать replyTo preview для сообщений с replyToMessageId', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = Number(createChatResponse.body.id);

      const original = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 2,
          text: 'Original text',
          clientMessageId: crypto.randomUUID(),
        },
      });

      const replyResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({
          receiverId: '2',
          text: 'Reply text',
          clientMessageId: crypto.randomUUID(),
          replyToMessageId: String(original.id),
        })
        .expect(201);

      expect(replyResponse.body.replyTo).toEqual({
        id: String(original.id),
        senderId: '2',
        text: 'Original text',
        deletedForEveryone: false,
      });

      const historyResponse = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .query({ limit: 10 })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      const replyInHistory = historyResponse.body.items.find(
        (item: { id: string }) => item.id === replyResponse.body.id,
      );

      expect(replyInHistory).toEqual(
        expect.objectContaining({
          text: 'Reply text',
          replyTo: {
            id: String(original.id),
            senderId: '2',
            text: 'Original text',
            deletedForEveryone: false,
          },
        }),
      );
    });
  });

  describe('POST /messenger/chats/:chatId/read', () => {
    it('должен отметить сообщения прочитанными, обнулить unreadCount и эмитить WS-события', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = Number(createChatResponse.body.id);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 2,
          text: 'unread',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await appTestManager.prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
        },
      });

      const chatsBefore = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(chatsBefore.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(chatId),
          unreadCount: 1,
        }),
      );

      const emitToUserSpy = jest.spyOn(
        appTestManager.getApp().get(MessengerWebSocketService),
        'emitToUser',
      );

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ lastReadMessageId: String(message.id) })
        .expect(204);

      const readState = await appTestManager.prisma.chatReadState.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: 1,
          },
        },
      });

      expect(readState).toEqual(
        expect.objectContaining({
          lastReadMessageId: message.id,
          lastReadAt: expect.any(Date),
        }),
      );

      const chatsAfter = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(chatsAfter.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(chatId),
          unreadCount: 0,
        }),
      );

      expect(emitToUserSpy).toHaveBeenCalledWith(
        2,
        MessengerWsEvent.MessageRead,
        expect.objectContaining({
          chatId: String(chatId),
          lastReadMessageId: String(message.id),
          readByUserId: '1',
          readAt: expect.any(String),
        }),
      );
      expect(emitToUserSpy).toHaveBeenCalledWith(
        1,
        MessengerWsEvent.ChatUpdated,
        expect.objectContaining({
          chatId: String(chatId),
          unreadCount: 0,
        }),
      );
      expect(emitToUserSpy).toHaveBeenCalledWith(
        2,
        MessengerWsEvent.ChatUpdated,
        expect.objectContaining({
          chatId: String(chatId),
          unreadCount: expect.any(Number),
        }),
      );

      emitToUserSpy.mockRestore();
    });

    it('должен делать no-op без даунгрейда lastReadMessageId', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = Number(createChatResponse.body.id);

      const firstMessage = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 2,
          text: 'first',
          clientMessageId: crypto.randomUUID(),
        },
      });
      const secondMessage = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 2,
          text: 'second',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ lastReadMessageId: String(secondMessage.id) })
        .expect(204);

      const emitToUserSpy = jest.spyOn(
        appTestManager.getApp().get(MessengerWebSocketService),
        'emitToUser',
      );

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ lastReadMessageId: String(firstMessage.id) })
        .expect(204);

      const readState = await appTestManager.prisma.chatReadState.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: 1,
          },
        },
      });

      expect(readState?.lastReadMessageId).toBe(secondMessage.id);
      expect(emitToUserSpy).not.toHaveBeenCalled();

      emitToUserSpy.mockRestore();
    });

    it('должен вернуть 404, если сообщение не принадлежит чату', async () => {
      const firstChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const secondChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '3' })
        .expect(200);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: Number(secondChatResponse.body.id),
          senderId: 3,
          text: 'other chat',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${firstChatResponse.body.id}/read`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ lastReadMessageId: String(message.id) })
        .expect(404);
    });

    it('должен вернуть 403, если пользователь не участник чата', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${createChatResponse.body.id}/read`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(3)}`)
        .send({ lastReadMessageId: '1' })
        .expect(403);
    });
  });

  describe('PATCH /messenger/messages/:messageId', () => {
    it('должен отредактировать сообщение, вернуть MessageViewDto и эмитить message.updated обоим', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = Number(createChatResponse.body.id);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 1,
          text: 'Hello!',
          clientMessageId: crypto.randomUUID(),
        },
      });

      const emitToUserSpy = jest.spyOn(
        appTestManager.getApp().get(MessengerWebSocketService),
        'emitToUser',
      );

      const response = await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ text: 'Updated text' })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: String(message.id),
          chatId: String(chatId),
          senderId: '1',
          receiverId: '2',
          text: 'Updated text',
          editedAt: expect.any(String),
          deletedForEveryone: false,
          status: 'sent',
        }),
      );

      const updated = await appTestManager.prisma.message.findUnique({
        where: { id: message.id },
      });

      expect(updated).toEqual(
        expect.objectContaining({
          text: 'Updated text',
          editedAt: expect.any(Date),
        }),
      );

      expect(emitToUserSpy).toHaveBeenCalledWith(
        1,
        MessengerWsEvent.MessageUpdated,
        expect.objectContaining({
          id: String(message.id),
          text: 'Updated text',
          editedAt: expect.any(String),
          status: 'sent',
        }),
      );
      expect(emitToUserSpy).toHaveBeenCalledWith(
        2,
        MessengerWsEvent.MessageUpdated,
        expect.objectContaining({
          id: String(message.id),
          text: 'Updated text',
          editedAt: expect.any(String),
          status: null,
        }),
      );

      const historyForUser1 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(historyForUser1.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(message.id),
          text: 'Updated text',
          editedAt: expect.any(String),
          status: 'sent',
        }),
      );

      const historyForUser2 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(historyForUser2.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(message.id),
          text: 'Updated text',
          editedAt: expect.any(String),
          status: null,
        }),
      );

      emitToUserSpy.mockRestore();
    });

    it('должен вернуть 403, если редактирует не автор', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: Number(createChatResponse.body.id),
          senderId: 1,
          text: 'Hello!',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .send({ text: 'Hacked' })
        .expect(403);
    });

    it('должен вернуть 403 EditWindowExpired, если окно редактирования истекло', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: Number(createChatResponse.body.id),
          senderId: 1,
          text: 'Hello!',
          clientMessageId: crypto.randomUUID(),
          createdAt: new Date(Date.now() - 16 * 60_000),
        },
      });

      const response = await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ text: 'Too late' })
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          code: 'EditWindowExpired',
        }),
      );
    });

    it('должен вернуть 403, если пользователь не участник чата', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: Number(createChatResponse.body.id),
          senderId: 1,
          text: 'Hello!',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(3)}`)
        .send({ text: 'No access' })
        .expect(403);
    });
  });

  describe('DELETE /messenger/messages/:messageId', () => {
    it('scope=me: должен скрыть сообщение только у одного пользователя в history и list', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = Number(createChatResponse.body.id);

      const older = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 1,
          text: 'Older',
          clientMessageId: crypto.randomUUID(),
          createdAt: new Date('2026-07-05T18:00:00.000Z'),
        },
      });
      const newer = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 2,
          text: 'Newer',
          clientMessageId: crypto.randomUUID(),
          createdAt: new Date('2026-07-05T18:01:00.000Z'),
        },
      });
      await appTestManager.prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageId: newer.id,
          lastMessageAt: newer.createdAt,
        },
      });

      const emitToUserSpy = jest.spyOn(
        appTestManager.getApp().get(MessengerWebSocketService),
        'emitToUser',
      );

      await request(appTestManager.getServer())
        .delete(`/${GLOBAL_PREFIX}/messenger/messages/${newer.id}`)
        .query({ scope: DeleteMessageScope.Me })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(204);

      expect(emitToUserSpy).toHaveBeenCalledWith(1, MessengerWsEvent.MessageDeleted, {
        messageId: String(newer.id),
        chatId: String(chatId),
        scope: DeleteMessageScope.Me,
      });
      expect(emitToUserSpy).not.toHaveBeenCalledWith(
        2,
        MessengerWsEvent.MessageDeleted,
        expect.anything(),
      );

      const historyForUser1 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(historyForUser1.body.items.map((item: { id: string }) => item.id)).toEqual([
        String(older.id),
      ]);

      const historyForUser2 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(historyForUser2.body.items.map((item: { id: string }) => item.id)).toEqual([
        String(newer.id),
        String(older.id),
      ]);

      const chatsForUser1 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(chatsForUser1.body.items[0].lastMessage).toEqual(
        expect.objectContaining({
          id: String(older.id),
          text: 'Older',
        }),
      );

      const chatsForUser2 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(chatsForUser2.body.items[0].lastMessage).toEqual(
        expect.objectContaining({
          id: String(newer.id),
          text: 'Newer',
        }),
      );

      const chatRow = await appTestManager.prisma.chat.findUnique({ where: { id: chatId } });
      expect(chatRow?.lastMessageId).toBe(newer.id);

      emitToUserSpy.mockRestore();
    });

    it('scope=everyone: должен оставить tombstone у обоих и эмитить message.deleted', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatId = Number(createChatResponse.body.id);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId,
          senderId: 1,
          text: 'Secret',
          clientMessageId: crypto.randomUUID(),
        },
      });
      await appTestManager.prisma.chat.update({
        where: { id: chatId },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
        },
      });

      const emitToUserSpy = jest.spyOn(
        appTestManager.getApp().get(MessengerWebSocketService),
        'emitToUser',
      );

      await request(appTestManager.getServer())
        .delete(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .query({ scope: DeleteMessageScope.Everyone })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(204);

      const updated = await appTestManager.prisma.message.findUnique({
        where: { id: message.id },
      });
      expect(updated).toEqual(
        expect.objectContaining({
          text: '',
          deletedForEveryone: true,
          deletedAt: expect.any(Date),
        }),
      );

      const historyForUser1 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(historyForUser1.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(message.id),
          text: '',
          deletedForEveryone: true,
          deletedAt: expect.any(String),
        }),
      );

      const historyForUser2 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(historyForUser2.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(message.id),
          text: '',
          deletedForEveryone: true,
          deletedAt: expect.any(String),
        }),
      );

      const chatsForUser1 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(chatsForUser1.body.items[0].lastMessage).toEqual(
        expect.objectContaining({
          id: String(message.id),
          text: '',
          deletedForEveryone: true,
        }),
      );

      expect(emitToUserSpy).toHaveBeenCalledWith(1, MessengerWsEvent.MessageDeleted, {
        messageId: String(message.id),
        chatId: String(chatId),
        scope: DeleteMessageScope.Everyone,
      });
      expect(emitToUserSpy).toHaveBeenCalledWith(2, MessengerWsEvent.MessageDeleted, {
        messageId: String(message.id),
        chatId: String(chatId),
        scope: DeleteMessageScope.Everyone,
      });

      emitToUserSpy.mockRestore();
    });

    it('scope=everyone: должен вернуть 403 DeleteWindowExpired после окна', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: Number(createChatResponse.body.id),
          senderId: 1,
          text: 'Too old',
          clientMessageId: crypto.randomUUID(),
          createdAt: new Date(Date.now() - 16 * 60_000),
        },
      });

      const response = await request(appTestManager.getServer())
        .delete(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .query({ scope: DeleteMessageScope.Everyone })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(403);

      expect(response.body).toEqual(
        expect.objectContaining({
          code: 'DeleteWindowExpired',
        }),
      );
    });

    it('scope=everyone: должен вернуть 403, если удаляет не автор', async () => {
      const createChatResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const message = await appTestManager.prisma.message.create({
        data: {
          chatId: Number(createChatResponse.body.id),
          senderId: 1,
          text: 'Hello!',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await request(appTestManager.getServer())
        .delete(`/${GLOBAL_PREFIX}/messenger/messages/${message.id}`)
        .query({ scope: DeleteMessageScope.Everyone })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(403);
    });
  });

  describe('GET /messenger/presence', () => {
    it('должен вернуть батч online/lastSeenAt', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 3,
          showActivityStatus: true,
          lastSeenAt: new Date('2026-07-19T11:00:00.000Z'),
        },
      });

      await redis.zadd('presence:2', Date.now(), 'sock-2');
      await redis.expire('presence:2', 30);

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2,3' })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body).toEqual([
        { userId: '2', online: true, lastSeenAt: null },
        { userId: '3', online: false, lastSeenAt: '2026-07-19T11:00:00.000Z' },
      ]);
    });

    it('должен скрывать статус при взаимной приватности (цель скрыла активность)', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 2,
          showActivityStatus: false,
          lastSeenAt: new Date('2026-07-19T11:00:00.000Z'),
        },
      });

      await redis.zadd('presence:2', Date.now(), 'sock-2');
      await redis.expire('presence:2', 30);

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2' })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body).toEqual([{ userId: '2', online: false, lastSeenAt: null }]);
    });

    it('должен скрывать чужие статусы, если запрашивающий скрыл активность', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 1,
          showActivityStatus: false,
        },
      });

      await redis.zadd('presence:2', Date.now(), 'sock-2');
      await redis.expire('presence:2', 30);

      const response = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2' })
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(response.body).toEqual([{ userId: '2', online: false, lastSeenAt: null }]);
    });

    it('должен вернуть 400 без userIds', async () => {
      await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(400);
    });

    it('должен вернуть 401 без authorization header', async () => {
      await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/presence`)
        .query({ userIds: '2' })
        .expect(401);
    });
  });

  describe('PATCH /messenger/settings/activity-status', () => {
    it('должен сохранить showActivityStatus=false и вернуть 204', async () => {
      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ showActivityStatus: false })
        .expect(204);

      const settings = await appTestManager.prisma.userPresenceSettings.findUnique({
        where: { userId: 1 },
      });

      expect(settings).toEqual(
        expect.objectContaining({
          userId: 1,
          showActivityStatus: false,
        }),
      );
    });

    it('должен включить обратно showActivityStatus=true', async () => {
      await appTestManager.prisma.userPresenceSettings.create({
        data: {
          userId: 1,
          showActivityStatus: false,
        },
      });

      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ showActivityStatus: true })
        .expect(204);

      const settings = await appTestManager.prisma.userPresenceSettings.findUnique({
        where: { userId: 1 },
      });

      expect(settings?.showActivityStatus).toBe(true);
    });

    it('должен вернуть 400 при отсутствии showActivityStatus', async () => {
      await request(appTestManager.getServer())
        .patch(`/${GLOBAL_PREFIX}/messenger/settings/activity-status`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({})
        .expect(400);
    });
  });

  describe('POST /messenger/chats', () => {
    it('должен идемпотентно возвращать существующий 1:1 чат', async () => {
      const firstResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const secondResponse = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(await appTestManager.prisma.chat.count()).toBe(1);

      const chat = await appTestManager.prisma.chat.findFirst();
      expect(chat).toEqual(
        expect.objectContaining({
          participantAId: 1,
          participantBId: 2,
          lastMessageId: null,
          lastMessageAt: null,
        }),
      );
    });

    it('должен возвращать тот же чат независимо от порядка участников', async () => {
      const responseAsUser1 = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const responseAsUser2 = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .send({ interlocutorId: '1' })
        .expect(200);

      expect(responseAsUser2.body.id).toBe(responseAsUser1.body.id);
      expect(await appTestManager.prisma.chat.count()).toBe(1);
    });
  });
});
