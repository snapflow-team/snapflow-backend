import { StripeCSModes } from './stripe-checkout-session-modes.enum';

export type CreateCheckoutSessionDto = {
  mode: StripeCSModes;
  stripePriceId: string;
  planId: string;
  userId: number;
  subscriptionDurationInDays: number;
  //Параметр, чтобы хранить в чекаут сессии привязку к нашей продлеваемой подписке
  extendingSubscriptionId?: string;
  stripeCusId?: string;
};
