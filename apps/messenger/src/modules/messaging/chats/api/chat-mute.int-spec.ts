import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OutboxEventStatus, OutboxEventType } from '@generated/prisma-messenger';
import { Redis } from 'ioredis';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { NewMessageNotificationDispatcherService } from '../../notifications/application/services/new-message-notification-dispatcher.service';
import { RabbitMQPublisherService } from '../../../rabbitmq/rabbitmq-publisher.service';

describe('Chat mute endpoints (Integration)', () => {
  let appTestManager: AppTestManager;
  let accessTokenTestHelper: AccessTokenTestHelper;
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

  const clientMessageId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  describe('POST/DELETE /messenger/chats/:chatId/mute', () => {
    async function createChatBetween(userId: number, interlocutorId: number): Promise<number> {
      const response = await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(userId)}`)
        .send({ interlocutorId: String(interlocutorId) })
        .expect(200);

      return Number(response.body.id);
    }

    it('должен замутить чат бессрочно, вернуть muted=true в списке и снять mute', async () => {
      const chatId = await createChatBetween(1, 2);

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/mute`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .send({})
        .expect(204);

      const muteRow = await appTestManager.prisma.chatMuteSettings.findUnique({
        where: { chatId_userId: { chatId, userId: 2 } },
      });
      expect(muteRow).toEqual(
        expect.objectContaining({
          chatId,
          userId: 2,
          mutedUntil: null,
        }),
      );

      const chatsForUser2 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(chatsForUser2.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(chatId),
          muted: true,
        }),
      );

      const chatsForUser1 = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .expect(200);

      expect(chatsForUser1.body.items[0]).toEqual(
        expect.objectContaining({
          id: String(chatId),
          muted: false,
        }),
      );

      await request(appTestManager.getServer())
        .delete(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/mute`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(204);

      expect(
        await appTestManager.prisma.chatMuteSettings.findUnique({
          where: { chatId_userId: { chatId, userId: 2 } },
        }),
      ).toBeNull();

      const chatsAfterUnmute = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(chatsAfterUnmute.body.items[0].muted).toBe(false);
    });

    it('должен сохранить временный mute по mutedUntil', async () => {
      const chatId = await createChatBetween(1, 2);
      const mutedUntil = '2026-08-23T12:00:00.000Z';

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/mute`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .send({ mutedUntil })
        .expect(204);

      const muteRow = await appTestManager.prisma.chatMuteSettings.findUnique({
        where: { chatId_userId: { chatId, userId: 2 } },
      });

      expect(muteRow?.mutedUntil?.toISOString()).toBe(mutedUntil);
    });

    it('не должен слать пуш при mute, но должен доставить сообщение и учесть unread', async () => {
      const chatId = await createChatBetween(1, 2);

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/mute`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .send({})
        .expect(204);

      const publishSpy = jest.spyOn(
        appTestManager.getApp().get(RabbitMQPublisherService),
        'publish',
      );

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(1)}`)
        .send({
          receiverId: '2',
          text: 'Muted hello',
          clientMessageId,
        })
        .expect(201);

      const history = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(history.body.items[0]).toEqual(
        expect.objectContaining({
          text: 'Muted hello',
          senderId: '1',
        }),
      );

      const unread = await request(appTestManager.getServer())
        .get(`/${GLOBAL_PREFIX}/messenger/chats/unread-count`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(2)}`)
        .expect(200);

      expect(unread.body).toEqual({ total: 1 });

      const pendingEvent = await appTestManager.prisma.outboxEvent.findFirst();
      expect(pendingEvent).toEqual(
        expect.objectContaining({
          status: OutboxEventStatus.PENDING,
          type: OutboxEventType.NEW_MESSAGE_NOTIFICATION,
        }),
      );

      const dispatcher = appTestManager.getApp().get(NewMessageNotificationDispatcherService);

      await dispatcher.dispatchPendingNotifications();

      expect(await appTestManager.prisma.outboxEvent.findFirst()).toEqual(
        expect.objectContaining({
          id: pendingEvent!.id,
          status: OutboxEventStatus.PENDING,
        }),
      );

      await appTestManager.prisma.outboxEvent.update({
        where: { id: pendingEvent!.id },
        data: { availableAt: new Date() },
      });

      await dispatcher.dispatchPendingNotifications();

      expect(publishSpy).not.toHaveBeenCalled();
      expect(await appTestManager.prisma.outboxEvent.findFirst()).toEqual(
        expect.objectContaining({
          id: pendingEvent!.id,
          status: OutboxEventStatus.SKIPPED,
          error: 'chat_muted',
        }),
      );

      publishSpy.mockRestore();
    });

    it('должен вернуть 403, если пользователь не участник чата', async () => {
      const chatId = await createChatBetween(1, 2);

      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/${chatId}/mute`)
        .set('Authorization', `Bearer ${accessTokenTestHelper.signAccessToken(3)}`)
        .send({})
        .expect(403);
    });

    it('должен вернуть 401 без authorization header', async () => {
      await request(appTestManager.getServer())
        .post(`/${GLOBAL_PREFIX}/messenger/chats/1/mute`)
        .send({})
        .expect(401);
    });
  });
});
