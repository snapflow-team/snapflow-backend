export type SubscriptionJobPayload = {
  userId: number;
  expireAt: string;
};
export type PaymentReminderJobPayload = {
  userId: number;
  nextPaymentAt: string;
};
export type SubscriptionNotificationPayload = {
  userId: number;
  expireAt: string;
  nextPaymentAt: string;
  subscriptionId: number;
};
