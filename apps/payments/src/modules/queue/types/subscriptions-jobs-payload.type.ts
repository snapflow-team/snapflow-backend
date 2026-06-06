export type SubscriptionJobPayload = {
  userId: number;
  expireAt: Date;
};
export type PaymentReminderJobPayload = {
  userId: number;
  nextPaymentAt: Date;
};
