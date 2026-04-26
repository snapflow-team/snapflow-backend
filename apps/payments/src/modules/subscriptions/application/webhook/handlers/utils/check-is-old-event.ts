import { Subscription } from '@generated/prisma-payments';
import Stripe from 'stripe';

export function checkIsOldEvent(event: Stripe.Event, localSub: Subscription) {
  return !(
    localSub.lastStripeEventAt && new Date(event.created * 1000) < localSub.lastStripeEventAt
  );
}
