export interface SubscriptionActivatedEvent {
  userId: number;
  planId: string;
  subscriptionId: number;
  currentPeriodEnd: string | null;
}
