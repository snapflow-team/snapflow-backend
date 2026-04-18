import { Injectable, Logger } from '@nestjs/common';
import { AccountType } from '@generated/prisma-snapflow';
import {
  PaymentsRoutingKey,
  SubscriptionActivatedEvent,
} from '../../../../../../libs/contracts/payments';
import {
  isCheckoutSessionExpiredEvent,
  isSubscriptionActivatedEvent,
  isSubscriptionRenewalFailedEvent,
} from './type-guards/payments-events.type-guards';
import { UsersRepository } from '../../user-accounts/users/infrastructure/users.repository';

@Injectable()
export class PaymentsUserSyncService {
  private readonly logger: Logger = new Logger(PaymentsUserSyncService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async applyRoutingKey(routingKey: PaymentsRoutingKey, payload: unknown): Promise<void> {
    switch (routingKey) {
      case PaymentsRoutingKey.SubscriptionActivated:
        if (!isSubscriptionActivatedEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }
        this.logger.warn(`Invalid ${payload.planId} payload`);
        await this.upsertBusinessSubscription(payload);
        break;
      case PaymentsRoutingKey.SubscriptionRenewalFailed: {
        if (!isSubscriptionRenewalFailedEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }
        this.logger.warn(
          `Payment failed for user ${payload.userId} (subscription=${payload.subscriptionId}, invoice=${payload.stripeInvoiceId}, code=${payload.failureCode ?? 'n/a'}, message=${payload.failureMessage ?? 'n/a'}, attempts=${payload.attemptCount ?? 'n/a'}, nextAttempt=${payload.nextPaymentAttempt ?? 'n/a'})`,
        );
        break;
      }
      case PaymentsRoutingKey.CheckoutSessionExpired: {
        if (!isCheckoutSessionExpiredEvent(payload)) {
          this.logger.warn(`Invalid ${routingKey} payload`);

          return;
        }
        this.logger.warn(
          `Checkout session expired for user ${payload.userId}, plan: ${payload.planId}, description: ${payload.description}`,
        );
        break;
      }
      default:
        this.logger.warn(`Unhandled routing key: ${routingKey}`);
    }
  }

  private async upsertBusinessSubscription(data: SubscriptionActivatedEvent): Promise<void> {
    const subscriptionActiveUntil: Date | null =
      data.currentPeriodEnd !== undefined
        ? data.currentPeriodEnd === null
          ? null
          : new Date(data.currentPeriodEnd)
        : null;

    await this.usersRepository.updateAccountType({
      userId: data.userId,
      accountType: AccountType.BUSINESS,
      subscriptionActiveUntil,
    });
  }
}
