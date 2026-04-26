export interface SubscriptionCancelledEvent {
  userId: number;
  planId: string;
  subscriptionId: number;
  cancelledAt: Date;
}
