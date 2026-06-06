import { Injectable } from '@nestjs/common';
import { NotificationsRoutingKey } from '../../../../../../../libs/contracts/payments';
import { WebsocketService } from './websocket.service';
import { ContextLogger } from '../../../logger/context-logger';
import { LoggerFactory } from '../../../logger/logger.factory';

@Injectable()
export class WebsocketNotificationService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly webSocketService: WebsocketService,
    //private readonly notificationsRepository: NotificationsRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(WebsocketNotificationService.name);
  }

  async applyRoutingKey(
    routingKey: NotificationsRoutingKey,
    payload: { userId: string; createdAt: string },
  ): Promise<void> {
    switch (routingKey) {
      case NotificationsRoutingKey.SubscriptionActivated:
        // if (!isSubscriptionActivatedEvent(payload)) {
        //   this.logger.warn(`Invalid ${routingKey} payload`);
        //
        //   return;
        // }
        this.logger.log(
          `Handling notification: routingKey=${routingKey}, userId=${payload.userId}`,
          this.applyRoutingKey.name,
        );

        this.sendMessageByWS(payload);
        break;

      // case NotificationsRoutingKey.SubscriptionRenewed: {
      //   if (!isSubscriptionRenewedEvent(payload)) {
      //     this.logger.warn(`Invalid ${routingKey} payload`);
      //
      //     return;
      //   }
      //   await this.renewBusinessSubscription(payload);
      //   break;
      // }
      //
      // case NotificationsRoutingKey.SubscriptionRenewalFailed: {
      //   if (!isSubscriptionRenewalFailedEvent(payload)) {
      //     this.logger.warn(`Invalid ${routingKey} payload`);
      //
      //     return;
      //   }
      //   this.logger.warn(
      //     `Payment failed for user ${payload.userId} (subscription=${payload.subscriptionId}, invoice=${payload.stripeInvoiceId}, code=${payload.failureCode ?? 'n/a'}, message=${payload.failureMessage ?? 'n/a'}, attempts=${payload.attemptCount ?? 'n/a'}, nextAttempt=${payload.nextPaymentAttempt ?? 'n/a'})`,
      //   );
      //   await this.deleteBusinessSubscription(payload);
      //   break;
      // }
      //
      // case PaymentsRoutingKey.CheckoutSessionExpired: {
      //   if (!isCheckoutSessionExpiredEvent(payload)) {
      //     this.logger.warn(`Invalid ${routingKey} payload`);
      //
      //     return;
      //   }
      //   this.logger.warn(
      //     `Checkout session expired for user ${payload.userId}, plan: ${payload.planId}, description: ${payload.description}`,
      //   );
      //   break;
      // }

      // case PaymentsRoutingKey.SubscriptionCancelled: {
      //   if (!isSubscriptionCancelledEvent(payload)) {
      //     this.logger.warn(`Invalid ${routingKey} payload`);
      //     return;
      //   }
      //   await this.deleteBusinessSubscription(payload);
      //   break;
      // }
      default:
        this.logger.warn(`Unhandled routing key: ${routingKey}`);
    }
  }
  private sendMessageByWS(payload: { userId: string; createdAt: string }): void {
    this.webSocketService.sendToUser(payload.userId, {
      type: 'SUBSCRIPTION_EXPIRES_7D',

      title: 'Подписка',

      message: 'Ваша подписка истекает через 7 дней',

      createdAt: new Date().toISOString(),

      expDate: payload.createdAt,
    });
  }
}
