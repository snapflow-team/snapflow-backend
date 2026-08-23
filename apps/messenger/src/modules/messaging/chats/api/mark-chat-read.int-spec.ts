import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import { MessengerWsEvent } from '@contracts/messenger';
import { AccessTokenTestHelper } from '../../../../../test/helpers/access-token-test.helper';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';

describe('Mark chat as read (Integration)', () => {
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
      expect(emitToUserSpy).toHaveBeenCalledWith(
        1,
        MessengerWsEvent.UnreadUpdated,
        expect.objectContaining({
          total: 0,
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
});
