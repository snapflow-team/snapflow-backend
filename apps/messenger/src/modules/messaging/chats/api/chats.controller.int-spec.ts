import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

describe('ChatsController (Integration)', () => {
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

  describe('GET /messenger/chats/unread-count', () => {
    it('должен вернуть суммарный бейдж, согласованный с суммой unreadCount из списка чатов', async () => {
      const chatWithUser2 = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '2' })
        .expect(200);

      const chatWithUser3 = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({ interlocutorId: '3' })
        .expect(200);

      const chatId2 = Number(chatWithUser2.body.id);
      const chatId3 = Number(chatWithUser3.body.id);

      const messageFrom2 = await appTestManager.prisma.message.create({
        data: {
          chatId: chatId2,
          senderId: 2,
          text: 'from-2',
          clientMessageId: crypto.randomUUID(),
        },
      });
      await appTestManager.prisma.message.create({
        data: {
          chatId: chatId3,
          senderId: 3,
          text: 'from-3-a',
          clientMessageId: crypto.randomUUID(),
        },
      });
      const messageFrom3b = await appTestManager.prisma.message.create({
        data: {
          chatId: chatId3,
          senderId: 3,
          text: 'from-3-b',
          clientMessageId: crypto.randomUUID(),
        },
      });

      await appTestManager.prisma.chat.update({
        where: { id: chatId2 },
        data: {
          lastMessageId: messageFrom2.id,
          lastMessageAt: messageFrom2.createdAt,
        },
      });
      await appTestManager.prisma.chat.update({
        where: { id: chatId3 },
        data: {
          lastMessageId: messageFrom3b.id,
          lastMessageAt: messageFrom3b.createdAt,
        },
      });

      const chatsResponse = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      const unreadSumFromChats: number = (
        chatsResponse.body.items as Array<{ unreadCount: number }>
      ).reduce((sum, chat) => sum + chat.unreadCount, 0);

      expect(unreadSumFromChats).toBe(3);

      const unreadCountResponse = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/unread-count`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(unreadCountResponse.body).toEqual({ total: 3 });
      expect(unreadCountResponse.body.total).toBe(unreadSumFromChats);
    });

    it('должен вернуть 401 без authorization header', async () => {
      await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/unread-count`)
        .expect(401);
    });
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
      expect(collectedIds).toEqual([...chatIds].sort((a, b) => b - a).map(String));
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
