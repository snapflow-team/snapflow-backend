import Stripe from 'stripe';

export function extractEventDate(event: Stripe.Event): Date {
  return new Date(event.created * 1000);
}
