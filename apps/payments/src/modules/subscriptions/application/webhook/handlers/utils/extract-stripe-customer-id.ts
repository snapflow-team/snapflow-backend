import { Customer } from '@generated/prisma-payments';

export function extractStripeCustomerId(customer: Customer | null) {
  if (customer && customer.stripeCusId) {
    return customer.stripeCusId;
  }

  if (customer && !customer.stripeCusId) {
    return undefined;
  }

  return undefined;
}
