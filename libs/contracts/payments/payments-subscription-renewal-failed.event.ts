export interface SubscriptionRenewalFailedEvent {
  userId: number;
  planId: string;
  subscriptionId: number;
  stripeInvoiceId: string;
  attemptCount: number;
  nextPaymentAttempt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}
