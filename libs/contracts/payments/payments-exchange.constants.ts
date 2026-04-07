export const PAYMENTS_EXCHANGE = 'payments_exchange';

export enum PaymentsRoutingKey {
  PaymentCompleted = 'PAYMENT_COMPLETED',
  PaymentFailed = 'PAYMENT_FAILED',
}

export const ALL_PAYMENTS_ROUTING_KEYS: readonly PaymentsRoutingKey[] =
  Object.values(PaymentsRoutingKey);
