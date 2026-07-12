import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../libs/common/constants/global-prefix.constant';
import { AccessTokenTestHelper } from '../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../test/managers/app.test-manager';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';

describe('MessagingController (Integration)', () => {
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

  it('должен вернуть 201 и созданное сообщение при валидном запросе', async () => {
    const response = await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: 'Hello!',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '1',
        chatId: '1',
        senderId: '1',
        receiverId: '2',
        text: 'Hello!',
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

  it('должен вернуть 400 при пустом или пробельном тексте сообщения', async () => {
    await request(appTestManager.getServer())
      .post(`/${GLOBAL_PREFIX}/messenger/messages`)
      .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
      .send({
        receiverId: '2',
        text: '   ',
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
