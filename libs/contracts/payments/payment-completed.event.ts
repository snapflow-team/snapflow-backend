export interface PaymentCompletedEvent {
  userId: number;
  planId: string;
  subscriptionId: number;
  currentPeriodEnd: string | null;
}
