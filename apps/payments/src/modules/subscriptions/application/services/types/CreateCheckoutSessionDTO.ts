export type CreateCheckoutSessionDTO = {
  stripePriceId: string;
  planId: string;
  userId: number;
  stripeCusId?: string;
};
