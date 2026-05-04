import { Plan } from '../../../../setup/configuration/business-rules-settings';

export type CreatePendingPaymentInfrastructureDto = {
  plan: Plan;
  externalId: string;
  subscriptionId: number;
};
