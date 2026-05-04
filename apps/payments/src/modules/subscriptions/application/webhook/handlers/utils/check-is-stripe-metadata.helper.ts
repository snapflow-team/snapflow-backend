import Stripe from 'stripe';
import { CheckoutSessionMetadata } from '../../../types/checkout-session-metadata.type';

export function checkIsMetadata(
  metadata: Stripe.Metadata | null,
): metadata is CheckoutSessionMetadata {
  return !!metadata;
}
