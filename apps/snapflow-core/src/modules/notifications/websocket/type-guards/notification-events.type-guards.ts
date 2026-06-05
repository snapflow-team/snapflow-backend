import {
  ALL_NOTIFICATIONS_ROUTING_KEYS,
  NotificationsRoutingKey,
  SubscriptionActivatedEvent,
} from '../../../../../../../libs/contracts/payments';

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
): payload is SubscriptionActivatedEvent {
  return (
    isRecord(payload) &&
    typeof payload.userId === 'number' &&
    typeof payload.planId === 'string' &&
    typeof payload.subscriptionId === 'number' &&
    (typeof payload.currentPeriodEnd === 'string' || payload.currentPeriodEnd === null)
  );
}

// export function isSubscriptionRenewedEvent(payload: unknown): payload is SubscriptionRenewedEvent {
//   return (
//     isRecord(payload) &&
//     typeof payload.userId === 'number' &&
//     typeof payload.planId === 'string' &&
//     typeof payload.subscriptionId === 'number' &&
//     typeof payload.currentPeriodEnd === 'string'
//   );
// }
//
// export function isSubscriptionRenewalFailedEvent(
//   payload: unknown,
// ): payload is SubscriptionRenewalFailedEvent {
//   return (
//     isRecord(payload) &&
//     typeof payload.userId === 'number' &&
//     typeof payload.planId === 'string' &&
//     typeof payload.subscriptionId === 'number' &&
//     typeof payload.stripeInvoiceId === 'string' &&
//     typeof payload.attemptCount === 'number' &&
//     (typeof payload.nextPaymentAttempt === 'string' || payload.nextPaymentAttempt === null) &&
//     (typeof payload.failureCode === 'string' || payload.failureCode === null) &&
//     (typeof payload.failureMessage === 'string' || payload.failureMessage === null)
//   );
// }
// export function isCheckoutSessionExpiredEvent(
//   payload: unknown,
// ): payload is CheckoutSessionExpiredEvent {
//   return (
//     isRecord(payload) &&
//     typeof payload.userId === 'number' &&
//     typeof payload.planId === 'string' &&
//     typeof payload.description === 'string'
//   );
// }
// export function isSubscriptionCancelledEvent(
//   payload: unknown,
// ): payload is SubscriptionCancelledEvent {
//   return (
//     isRecord(payload) &&
//     typeof payload.userId === 'number' &&
//     typeof payload.planId === 'string' &&
//     typeof payload.subscriptionId === 'number' &&
//     payload.cancelledAt instanceof Date
//   );
// }
