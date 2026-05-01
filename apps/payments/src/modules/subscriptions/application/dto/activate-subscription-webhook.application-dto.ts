import { BillingPeriod } from '../types/billing-period.type';

export class ActivateSubscriptionDto {
  subscriptionId: number;
  stripeSubId: string;
  currentPeriod: BillingPeriod;
  lastStripeEventAt: Date;
  stripeCusId: string;
}
