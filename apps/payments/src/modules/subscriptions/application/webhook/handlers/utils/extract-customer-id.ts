import Stripe from 'stripe';

export function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (typeof customer === 'string') return customer;
  if (typeof customer === 'object' && customer && 'id' in customer) return customer.id;
  return null;
}
