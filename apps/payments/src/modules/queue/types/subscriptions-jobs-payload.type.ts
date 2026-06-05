export type SubscriptionJobPayload = {
  subscriptionId: string;
  userId: string;
};
export type ExpirationJobPayload = SubscriptionJobPayload & {
  expiresAt: string;
};
export type PaymentReminderPayload = SubscriptionJobPayload & {
  nextPaymentAt: string;
};
