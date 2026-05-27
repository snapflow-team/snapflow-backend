export interface SubscriptionRenewedEvent {
  userId: number;
  planId: string;
  subscriptionId: number;
  currentPeriodEnd: string;
}
