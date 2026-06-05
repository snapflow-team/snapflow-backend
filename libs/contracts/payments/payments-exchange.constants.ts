export const PAYMENTS_EXCHANGE = 'payments_exchange';

export enum PaymentsRoutingKey {
  SubscriptionActivated = 'SUBSCRIPTION_ACTIVATED',
  SubscriptionRenewed = 'SUBSCRIPTION_RENEWED',
  CheckoutSessionExpired = 'CHECKOUT_SESSION_EXPIRED',
  SubscriptionRenewalFailed = 'SUBSCRIPTION_RENEWAL_FAILED',
  SubscriptionCancelled = 'SUBSCRIPTION_CANCELLED',
}

export enum NotificationsRoutingKey {
  SubscriptionActivated = 'SUBSCRIPTION_ACTIVATED_NOTIFICATION',
  SubscriptionExpiringIn7Days = 'SubscriptionExpiringIn7Days',
  SubscriptionExpiringIn1Day = 'SubscriptionExpiringIn1Day',
  NextPaymentRemindIn1Day = 'NextPaymentRemindIn1',
}

export const ALL_PAYMENTS_ROUTING_KEYS: readonly PaymentsRoutingKey[] =
  Object.values(PaymentsRoutingKey);

export const ALL_NOTIFICATIONS_ROUTING_KEYS: readonly NotificationsRoutingKey[] =
  Object.values(NotificationsRoutingKey);
