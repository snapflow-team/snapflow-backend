export const PAYMENTS_EXCHANGE = 'payments_exchange';

export enum PaymentsRoutingKey {
  SubscriptionActivated = 'SUBSCRIPTION_ACTIVATED',
  CheckoutSessionExpired = 'CHECKOUT_SESSION_EXPIRED',
  SubscriptionRenewalFailed = 'SUBSCRIPTION_RENEWAL_FAILED',
}

export const ALL_PAYMENTS_ROUTING_KEYS: readonly PaymentsRoutingKey[] =
  Object.values(PaymentsRoutingKey);
