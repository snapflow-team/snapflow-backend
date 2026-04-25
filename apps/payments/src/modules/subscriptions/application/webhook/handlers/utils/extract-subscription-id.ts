import Stripe from 'stripe';

export function extractSubscriptionId(
  subscription: string | Stripe.Subscription | undefined,
): string | null {
  if (typeof subscription === 'string') {
    return subscription;
  }

  if (
    subscription &&
    typeof subscription === 'object' &&
    'id' in subscription &&
    typeof subscription.id === 'string'
  ) {
    return subscription.id;
  }

  return null;
}
