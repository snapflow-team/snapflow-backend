import {
  ALL_PAYMENTS_ROUTING_KEYS,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentsRoutingKey,
} from '../../../../../../../libs/contracts/payments';

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null;
}

function isPaymentsRoutingKey(routingKey: string): routingKey is PaymentsRoutingKey {
  return ALL_PAYMENTS_ROUTING_KEYS.some((key) => key === routingKey);
}

export function parsePaymentsRoutingKey(routingKey: string): PaymentsRoutingKey | null {
  return isPaymentsRoutingKey(routingKey) ? routingKey : null;
}

export function isPaymentCompletedEvent(payload: unknown): payload is PaymentCompletedEvent {
  return (
    isRecord(payload) &&
    typeof payload.userId === 'number' &&
    typeof payload.planId === 'string' &&
    typeof payload.subscriptionId === 'number' &&
    (typeof payload.currentPeriodEnd === 'string' || payload.currentPeriodEnd === null)
  );
}

export function isPaymentFailedEvent(payload: unknown): payload is PaymentFailedEvent {
  return (
    isRecord(payload) &&
    typeof payload.userId === 'number' &&
    typeof payload.planId === 'string' &&
    typeof payload.subscriptionId === 'number' &&
    typeof payload.stripeInvoiceId === 'string' &&
    typeof payload.attemptCount === 'number' &&
    (typeof payload.nextPaymentAttempt === 'string' || payload.nextPaymentAttempt === null) &&
    (typeof payload.failureCode === 'string' || payload.failureCode === null) &&
    (typeof payload.failureMessage === 'string' || payload.failureMessage === null)
  );
}
