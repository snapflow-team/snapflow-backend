import { ConfigService } from '@nestjs/config';
import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { NotificationType } from '@generated/prisma-snapflow';
import {
  MESSENGER_EXCHANGE,
  MessengerNotificationsRoutingKey,
  NewMessageNotificationEvent,
} from '../../../../../../../libs/contracts/messenger';
import { AppTestManager } from '../../../../../test/managers/app.test-manager';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { WebPushSenderService } from '../../push/services/web-push-sender.service';
import { WebsocketService } from './websocket.service';
import { MessengerEventsConsumer } from './messenger-events.consumer';

jest.setTimeout(20_000);

type ConnectableChannelWrapper = {
  waitForConnect: () => Promise<void>;
};

describe('MessengerEventsConsumer (Integration)', () => {
  let appTestManager: AppTestManager;
  let rabbitConnection: ChannelModel;
  let rabbitChannel: ConfirmChannel;
  let queueName: string;
  let webPushSendToUser: jest.Mock;

  beforeAll(async () => {
    webPushSendToUser = jest.fn().mockResolvedValue(undefined);

    appTestManager = new AppTestManager();
    await appTestManager.init((builder) => {
      builder.overrideProvider(WebPushSenderService).useValue({
        onModuleInit: jest.fn(),
        sendToUser: webPushSendToUser,
      });
    });

    const apiSettings = appTestManager
      .getApp()
      .get(ConfigService<Configuration, true>)
      .get<ApiSettings>('apiSettings');

    queueName = apiSettings.messengerEventsQueueName;

    const consumer = appTestManager.getApp().get(MessengerEventsConsumer);
    const channelWrapper = (
      consumer as unknown as { channelWrapper?: ConnectableChannelWrapper }
    ).channelWrapper;

    if (!channelWrapper) {
      throw new Error('MessengerEventsConsumer did not create a RabbitMQ channel');
    }

    await channelWrapper.waitForConnect();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await channelWrapper.waitForConnect();

    rabbitConnection = await amqp.connect(apiSettings.rabbitMqUrl);
    rabbitChannel = await rabbitConnection.createConfirmChannel();
    await rabbitChannel.assertExchange(MESSENGER_EXCHANGE, 'topic', { durable: true });
    await rabbitChannel.assertQueue(queueName, { durable: true });
    await rabbitChannel.bindQueue(
      queueName,
      MESSENGER_EXCHANGE,
      MessengerNotificationsRoutingKey.NewMessage,
    );
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
    webPushSendToUser.mockClear();

    const consumer = appTestManager.getApp().get(MessengerEventsConsumer);
    const channelWrapper = (
      consumer as unknown as { channelWrapper?: ConnectableChannelWrapper }
    ).channelWrapper;
    await channelWrapper?.waitForConnect();

    await rabbitChannel.purgeQueue(queueName);
  });

  afterAll(async () => {
    await rabbitChannel.close();
    await rabbitConnection.close();
    await appTestManager.close();
  });

  async function createUser(username: string, email: string) {
    return appTestManager.prisma.user.create({
      data: {
        username,
        email,
        password: 'passwordHash',
      },
    });
  }

  async function publishNewMessage(payload: NewMessageNotificationEvent): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      rabbitChannel.publish(
        MESSENGER_EXCHANGE,
        MessengerNotificationsRoutingKey.NewMessage,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    });
  }

  async function publishUntilProcessed(
    payload: NewMessageNotificationEvent,
    predicate: () => Promise<boolean>,
  ): Promise<void> {
    const startedAt = Date.now();
    let lastPublishAt = 0;

    while (Date.now() - startedAt < 12_000) {
      if (Date.now() - lastPublishAt >= 1_000) {
        await publishNewMessage(payload);
        lastPublishAt = Date.now();
      }

      if (await predicate()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('Timeout waiting for messenger consumer to process event');
  }

  it('должен сохранить уведомление, отправить WS и Web Push', async () => {
    const sender = await createUser('alice', 'alice@mail.ru');
    const recipient = await createUser('bob', 'bob@mail.ru');
    const sendToUserSpy = jest.spyOn(appTestManager.getApp().get(WebsocketService), 'sendToUser');

    const payload: NewMessageNotificationEvent = {
      eventId: randomUUID(),
      chatId: '10',
      lastMessageId: '100',
      senderId: sender.id,
      recipientId: recipient.id,
      preview: 'Привет из RabbitMQ',
      missedCount: 1,
      unreadTotal: 3,
      sentAt: '2026-08-22T12:00:00.000Z',
    };

    await publishUntilProcessed(
      payload,
      async () => (await appTestManager.prisma.notification.count()) === 1,
    );

    const notification = await appTestManager.prisma.notification.findFirst();

    expect(notification).toEqual(
      expect.objectContaining({
        userId: recipient.id,
        type: NotificationType.NEW_MESSAGE,
        message: 'Привет из RabbitMQ',
      }),
    );

    const consumed = await appTestManager.prisma.consumedEvent.findUnique({
      where: { eventId: payload.eventId },
    });
    expect(consumed).toEqual(
      expect.objectContaining({
        eventId: payload.eventId,
        source: 'messenger',
      }),
    );

    expect(sendToUserSpy).toHaveBeenCalledWith(
      recipient.id,
      expect.objectContaining({
        type: NotificationType.NEW_MESSAGE,
        message: 'Привет из RabbitMQ',
      }),
    );
    expect(webPushSendToUser).toHaveBeenCalledWith(recipient.id, {
      title: 'Новое сообщение от alice',
      body: 'Привет из RabbitMQ',
      tag: 'messenger-chat-10',
      data: {
        chatId: '10',
        url: '/messenger/10',
        unreadTotal: 3,
      },
    });

    sendToUserSpy.mockRestore();
  });

  it('повторная доставка того же eventId не создаёт второе уведомление', async () => {
    const sender = await createUser('alice', 'alice@mail.ru');
    const recipient = await createUser('bob', 'bob@mail.ru');

    const payload: NewMessageNotificationEvent = {
      eventId: randomUUID(),
      chatId: '11',
      lastMessageId: '200',
      senderId: sender.id,
      recipientId: recipient.id,
      preview: 'Дубликат',
      missedCount: 2,
      unreadTotal: 4,
      sentAt: '2026-08-22T12:00:00.000Z',
    };

    await publishUntilProcessed(
      payload,
      async () => (await appTestManager.prisma.notification.count()) === 1,
    );

    webPushSendToUser.mockClear();

    await publishNewMessage(payload);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(await appTestManager.prisma.notification.count()).toBe(1);
    expect(await appTestManager.prisma.consumedEvent.count()).toBe(1);
    expect(webPushSendToUser).not.toHaveBeenCalled();
  });
});
