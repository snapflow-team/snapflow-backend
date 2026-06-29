import {
  ALL_NOTIFICATIONS_ROUTING_KEYS,
  NotificationsRoutingKey,
} from '../../../../../../../libs/contracts/payments';
import { SubscriptionActivatedNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-activated-notification.event';
import { PaymentSubscriptionExpiring7dNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-expiring-7d-notification.event';
import { PaymentSubscriptionExpiring1dNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-expiring-1d-notification.event';
import { PaymentSubscriptionNextPayment1dNotificationEvent } from '../../../../../../../libs/contracts/payments/notifications/payment-subscription-next-payment-1d-notification.event';

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null;
}

function isNotificationsRoutingKey(routingKey: string): routingKey is NotificationsRoutingKey {
  return ALL_NOTIFICATIONS_ROUTING_KEYS.some((key) => key === routingKey);
}

export function parseNotificationsRoutingKey(routingKey: string): NotificationsRoutingKey | null {
  return isNotificationsRoutingKey(routingKey) ? routingKey : null;
}

export function isSubscriptionActivatedEvent(
  payload: unknown,
): payload is SubscriptionActivatedNotificationEvent {
  return (
    isRecord(payload) && typeof payload.userId === 'number' && typeof payload.expireAt === 'string'
  );
}

export function isSubscriptionExpiring7DEvent(
  payload: unknown,
): payload is PaymentSubscriptionExpiring7dNotificationEvent {
  return (
    isRecord(payload) && typeof payload.userId === 'number' && typeof payload.expireAt === 'string'
  );
}

export function isSubscriptionExpiring1DEvent(
  payload: unknown,
): payload is PaymentSubscriptionExpiring1dNotificationEvent {
  return (
    isRecord(payload) && typeof payload.userId === 'number' && typeof payload.expireAt === 'string'
  );
}
export function isNextPaymentReminder1DNotificationEvent(
  payload: unknown,
): payload is PaymentSubscriptionNextPayment1dNotificationEvent {
  return (
    isRecord(payload) &&
    typeof payload.userId === 'number' &&
    typeof payload.nextPaymentAt === 'string'
  );
}
