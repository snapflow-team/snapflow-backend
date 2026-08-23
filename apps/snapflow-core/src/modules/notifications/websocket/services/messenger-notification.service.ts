import { Injectable } from '@nestjs/common';
import { NotificationType } from '@generated/prisma-snapflow';
import {
  MessengerNotificationsRoutingKey,
  NewMessageNotificationEvent,
} from '../../../../../../../libs/contracts/messenger';
import { UsersRepository } from '../../../user-accounts/users/infrastructure/users.repository';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { ConsumedEventsRepository } from '../../infrastructure/consumed-events.repository';
import { NotificationsRepository } from '../../infrastructure/notifications.repository';
import { WebPushSenderService } from '../../push/services/web-push-sender.service';
import { WebsocketService } from './websocket.service';
import { isNewMessageNotificationEvent } from '../types/type-guards/messenger-notification-events.type-guards';

const MESSENGER_EVENT_SOURCE = 'messenger';

@Injectable()
export class MessengerNotificationService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly consumedEventsRepository: ConsumedEventsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly webSocketService: WebsocketService,
    private readonly webPushSenderService: WebPushSenderService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(MessengerNotificationService.name);
  }

  async applyRoutingKey(
    routingKey: MessengerNotificationsRoutingKey,
    payload: unknown,
  ): Promise<void> {
    switch (routingKey) {
      case MessengerNotificationsRoutingKey.NewMessage: {
        if (!isNewMessageNotificationEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`, this.applyRoutingKey.name);

          return;
        }

        this.logger.log(
          `Handling messenger notification: routingKey=${routingKey}, recipientId=${payload.recipientId}`,
          this.applyRoutingKey.name,
        );

        await this.handleNewMessageNotification(payload);
        break;
      }
      default:
        this.logger.warn(`Unhandled routing key: ${routingKey}`, this.applyRoutingKey.name);
    }
  }

  private async handleNewMessageNotification(payload: NewMessageNotificationEvent): Promise<void> {
    const consumed: boolean = await this.consumedEventsRepository.tryConsume(
      payload.eventId,
      MESSENGER_EVENT_SOURCE,
    );

    if (!consumed) {
      this.logger.log(
        `Duplicate messenger event ${payload.eventId}, skipping`,
        this.handleNewMessageNotification.name,
      );

      return;
    }

    try {
      const senderUsername = await this.resolveSenderUsername(payload.senderId);
      const message = this.buildNotificationMessage(payload, senderUsername);

      const createdNotification = await this.notificationsRepository.create({
        userId: payload.recipientId,
        message,
        payload: JSON.stringify(payload),
        type: NotificationType.NEW_MESSAGE,
      });

      this.webSocketService.sendToUser(payload.recipientId, {
        type: createdNotification.type,
        message: createdNotification.message,
        createdAt: createdNotification.createdAt.toISOString(),
      });

      await this.webPushSenderService.sendToUser(payload.recipientId, {
        title: `Новое сообщение от ${senderUsername}`,
        body: payload.preview,
        tag: `messenger-chat-${payload.chatId}`,
        data: {
          chatId: payload.chatId,
          url: `/messenger/${payload.chatId}`,
          unreadTotal: payload.unreadTotal,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Не удалось сохранить уведомление или доставить его пользователю ${payload.recipientId}, Error: ${errorMessage}`,
        this.handleNewMessageNotification.name,
      );
    }
  }

  private async resolveSenderUsername(senderId: number): Promise<string> {
    const sender = await this.usersRepository.findUserById(senderId);

    return sender?.username ?? 'Пользователь';
  }

  private buildNotificationMessage(
    payload: NewMessageNotificationEvent,
    senderUsername: string,
  ): string {
    if (payload.missedCount > 1) {
      return `${payload.missedCount} новых сообщений от ${senderUsername}`;
    }

    return payload.preview;
  }
}
