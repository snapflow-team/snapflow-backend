import { Injectable } from '@nestjs/common';
import { NotificationsRoutingKey } from '../../../../../../../libs/contracts/payments';
import { WebsocketService } from './websocket.service';
import { ContextLogger } from '../../../logger/context-logger';
import { LoggerFactory } from '../../../logger/logger.factory';
import {
  isNextPaymentReminder1DNotificationEvent,
  isSubscriptionActivatedEvent,
  isSubscriptionExpiring1DEvent,
  isSubscriptionExpiring7DEvent,
} from '../type-guards/notification-events.type-guards';
import { SubscriptionActivatedNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-activated-notification.event';
import { NotificationType } from '@generated/prisma-snapflow';
import { PaymentSubscriptionNextPayment1dNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-next-payment-1d-notification.event';
import { PaymentSubscriptionExpiring7dNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-expiring-7d-notification.event';
import { PaymentSubscriptionExpiring1dNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-expiring-1d-notification.event';
import { NotificationsRepository } from '../../infrastructure/notifications.repository';

@Injectable()
export class WebsocketNotificationService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly webSocketService: WebsocketService,
    private readonly notificationsRepository: NotificationsRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(WebsocketNotificationService.name);
  }

  async applyRoutingKey(routingKey: NotificationsRoutingKey, payload: unknown): Promise<void> {
    switch (routingKey) {
      case NotificationsRoutingKey.SubscriptionActivated:
        if (!isSubscriptionActivatedEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }
        this.logger.log(
          `Handling notification: routingKey=${routingKey}, userId=${payload.userId}`,
          this.applyRoutingKey.name,
        );

        await this.sendActivatedSubscriptionToUserByWS(payload);
        break;

      case NotificationsRoutingKey.SubscriptionExpiringIn7Days: {
        if (!isSubscriptionExpiring7DEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }
        this.logger.log(
          `Handling notification: routingKey=${routingKey}, userId=${payload.userId}`,
          this.applyRoutingKey.name,
        );

        await this.sendExpiringSubscription7DToUserByWS(payload);
        break;
      }

      case NotificationsRoutingKey.SubscriptionExpiringIn1Day: {
        if (!isSubscriptionExpiring1DEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }

        this.logger.log(
          `Handling notification: routingKey=${routingKey}, userId=${payload.userId}`,
          this.applyRoutingKey.name,
        );

        await this.sendExpiringSubscription1DToUserByWS(payload);
        break;
      }
      case NotificationsRoutingKey.NextPaymentReminderIn1Day: {
        if (!isNextPaymentReminder1DNotificationEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }

        this.logger.log(
          `Handling notification: routingKey=${routingKey}, userId=${payload.userId}`,
          this.applyRoutingKey.name,
        );

        await this.sendNextPayment1DToUserByWS(payload);
        break;
      }
      default:
        this.logger.warn(`Unhandled routing key: ${routingKey}`);
    }
  }
  private async sendActivatedSubscriptionToUserByWS(
    payload: SubscriptionActivatedNotificationEvent,
  ): Promise<void> {
    try {
      const message = `Ваша подписка активирована и действует до ${payload.expireAt}`;

      const createdNotification = await this.notificationsRepository.create({
        userId: payload.userId,
        message,
        payload: JSON.stringify(payload),
        type: NotificationType.SUBSCRIPTION_ACTIVATED,
      });

      this.webSocketService.sendToUser(payload.userId, {
        type: createdNotification.type,
        message: createdNotification.message,
        createdAt: createdNotification.createdAt.toISOString(),
      });

      this.logger.log(
        'Notification successfully sent to websocket service in websocket notification service',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';

      this.logger.error(
        `Не удалось сохранить уведомление, либо отправить его пользователю ${payload.userId}, Error: ${errorMessage}`,
        this.sendActivatedSubscriptionToUserByWS.name,
      );
    }
  }
  private async sendExpiringSubscription7DToUserByWS(
    payload: PaymentSubscriptionExpiring7dNotificationEvent,
  ): Promise<void> {
    try {
      const message = `Ваша подписка истекает через 7 дней. Она истечет: ${payload.expireAt}`;

      const createdNotification = await this.notificationsRepository.create({
        userId: payload.userId,
        message,
        payload: JSON.stringify(payload),
        type: NotificationType.SUBSCRIPTION_EXPIRING_7D,
      });

      this.webSocketService.sendToUser(payload.userId, {
        type: createdNotification.type,
        message: createdNotification.message,
        createdAt: createdNotification.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';

      this.logger.error(
        `Не удалось сохранить уведомление, либо отправить его пользователю ${payload.userId}, Error: ${errorMessage}`,
        this.sendExpiringSubscription7DToUserByWS.name,
      );
    }
  }

  private async sendExpiringSubscription1DToUserByWS(
    payload: PaymentSubscriptionExpiring1dNotificationEvent,
  ): Promise<void> {
    try {
      const message = `Ваша подписка истекает через 1 день. Она истечет: ${payload.expireAt}`;

      const createdNotification = await this.notificationsRepository.create({
        userId: payload.userId,
        message,
        payload: JSON.stringify(payload),
        type: NotificationType.SUBSCRIPTION_EXPIRING_1D,
      });

      this.webSocketService.sendToUser(payload.userId, {
        type: createdNotification.type,
        message: createdNotification.message,
        createdAt: createdNotification.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      this.logger.error(
        `Не удалось сохранить уведомление, либо отправить его пользователю ${payload.userId}, Error: ${errorMessage}`,
        this.sendExpiringSubscription1DToUserByWS.name,
      );
    }
  }

  private async sendNextPayment1DToUserByWS(
    payload: PaymentSubscriptionNextPayment1dNotificationEvent,
  ): Promise<void> {
    try {
      const message = `Следующий платеж у вас спишется через 1 день. Дата следующего платежа: ${payload.nextPaymentAt}`;

      const createdNotification = await this.notificationsRepository.create({
        userId: payload.userId,
        message,
        payload: JSON.stringify(payload),
        type: NotificationType.NEXT_PAYMENT_1D,
      });

      this.webSocketService.sendToUser(payload.userId, {
        type: createdNotification.type,
        message: createdNotification.message,
        createdAt: createdNotification.createdAt.toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      this.logger.error(
        `Не удалось сохранить уведомление, либо отправить его пользователю ${payload.userId}, Error: ${errorMessage}`,
        this.sendNextPayment1DToUserByWS.name,
      );
    }
  }
}
