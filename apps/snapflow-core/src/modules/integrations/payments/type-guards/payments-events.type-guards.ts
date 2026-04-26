import {
  ALL_PAYMENTS_ROUTING_KEYS,
  SubscriptionRenewalFailedEvent,
  PaymentsRoutingKey,
  SubscriptionActivatedEvent,
} from '../../../../../../../libs/contracts/payments';
import { CheckoutSessionExpiredEvent } from '../../../../../../../libs/contracts/payments/payments-checkout-sesion-expired.event';
import { SubscriptionCancelledEvent } from '../../../../../../../libs/contracts/payments/payments-subscription-cancelled.event';

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null;
}

function isPaymentsRoutingKey(routingKey: string): routingKey is PaymentsRoutingKey {
  return ALL_PAYMENTS_ROUTING_KEYS.some((key) => key === routingKey);
}

export function parsePaymentsRoutingKey(routingKey: string): PaymentsRoutingKey | null {
  return isPaymentsRoutingKey(routingKey) ? routingKey : null;
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

export function isSubscriptionRenewalFailedEvent(
  payload: unknown,
): payload is SubscriptionRenewalFailedEvent {
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
export function isCheckoutSessionExpiredEvent(
  payload: unknown,
): payload is CheckoutSessionExpiredEvent {
  return (
    isRecord(payload) &&
    typeof payload.userId === 'number' &&
    typeof payload.planId === 'string' &&
    typeof payload.description === 'string'
  );
}
export function isSubscriptionCancelledEvent(
  payload: unknown,
): payload is SubscriptionCancelledEvent {
  return (
    isRecord(payload) &&
    typeof payload.userId === 'number' &&
    typeof payload.planId === 'string' &&
    typeof payload.subscriptionId === 'number' &&
    payload.cancelledAt instanceof Date
  );
}
