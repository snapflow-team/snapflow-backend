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
  SubscriptionExpiringIn7Days = 'SUBSCRIPTION_EXPIRING_IN_7_DAYS',
  SubscriptionExpiringIn1Day = 'SUBSCRIPTION_EXPIRING_IN_1_DAY',
  NextPaymentReminderIn1Day = 'NEXT_PAYMENT_REMINDER_IN_1_DAY',
}

export const ALL_PAYMENTS_ROUTING_KEYS: readonly PaymentsRoutingKey[] =
  Object.values(PaymentsRoutingKey);

export const ALL_NOTIFICATIONS_ROUTING_KEYS: readonly NotificationsRoutingKey[] =
  Object.values(NotificationsRoutingKey);
