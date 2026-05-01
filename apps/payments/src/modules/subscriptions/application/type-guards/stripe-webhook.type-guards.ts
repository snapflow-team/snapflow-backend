import Stripe from 'stripe';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isCheckoutSessionObject(value: unknown): value is Stripe.Checkout.Session {
  if (!isRecord(value)) return false;
  return value.object === 'checkout.session';
}

export function isInvoiceObject(value: unknown): value is Stripe.Invoice {
  if (!isRecord(value)) return false;
  return value.object === 'invoice';
}
export function isSubscriptionObject(value: unknown): value is Stripe.Subscription {
  if (!isRecord(value)) return false;
  return value.object === 'subscription';
}
