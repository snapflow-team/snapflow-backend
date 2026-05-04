import { StripeCSModes } from './stripe-checkout-session-modes.enum';
import { Plan } from '../../../../../setup/configuration/business-rules-settings';

export type CreateCheckoutSessionDto = {
  mode: StripeCSModes;
  plan: Plan;
  userId: number;
  stripeCusId?: string;
};
