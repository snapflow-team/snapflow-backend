import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OutboxEventStatus, OutboxEventType } from '@generated/prisma-messenger';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import { MessengerWsEvent } from '@contracts/messenger';
import { DeleteMessageScope } from './input-dto/delete-message.query-dto';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';

describe('MessagesController (Integration)', () => {
  let appTestManager: AppTestManager;
  let accessTokenTestHelper: AccessTokenTestHelper;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    const apiSettings = appTestManager
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');
    const jwtService = new JwtService({ secret: apiSettings.accessTokenSecret });

    accessTokenTestHelper = new AccessTokenTestHelper(jwtService);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  const clientMessageId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  describe('POST /messenger/messages', () => {
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
      expect(collectedIds.map(Number)).toEqual([...expectedIds].sort((a, b) => b - a));
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

  describe('outbox after POST /messenger/messages', () => {
    it('должен записать NEW_MESSAGE_NOTIFICATION в outbox_events с отложенным availableAt', async () => {
      const before = Date.now();

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({
          receiverId: '2',
          text: 'Hello!',
          clientMessageId,
        })
        .expect(201);

      const events = await appTestManager.prisma.outboxEvent.findMany();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(
        expect.objectContaining({
          type: OutboxEventType.NEW_MESSAGE_NOTIFICATION,
          status: OutboxEventStatus.PENDING,
          payload: {
            chatId: 1,
            messageId: 1,
            senderId: 1,
            recipientId: 2,
          },
        }),
      );
      expect(events[0].availableAt.getTime()).toBeGreaterThanOrEqual(before + 19_000);
    });

    it('не должен создавать повторное outbox-событие при идемпотентном POST', async () => {
      const payload = {
        receiverId: '2',
        text: 'Hello!',
        clientMessageId,
      };

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send(payload)
        .expect(201);

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send(payload)
        .expect(201);

      expect(await appTestManager.prisma.outboxEvent.count()).toBe(1);
    });
  });
});
