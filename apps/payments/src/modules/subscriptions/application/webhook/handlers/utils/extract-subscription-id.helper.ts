import Stripe from 'stripe';
import { checkIsMetadata } from '../../../type-guards/check-is-stripe-metadata.type-guard';

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
export function extractSubscriptionIdFromCS(
  checkoutSession: Stripe.Checkout.Session,
): string | null {
  const subscription = checkoutSession.subscription;
  if (typeof subscription === 'string') {
    return subscription;
  }
  if (subscription && typeof subscription === 'object') {
    return subscription.id;
  }
  //Проверяем subscriptionId в мета дате, если она прикреплялась к одноразовому платежу за подписку
  if (
    checkIsMetadata(checkoutSession.metadata) &&
    checkoutSession.metadata.extendingSubscriptionId
  ) {
    return checkoutSession.metadata.extendingSubscriptionId;
  }
  return null;
}
