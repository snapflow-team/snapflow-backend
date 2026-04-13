import { Plan } from '../../../../setup/configuration/business-rules-settings';

export class PlanViewDto {
  id: string;
  label: string;
  priceInCents: number;

  static mapToView(plan: Plan): PlanViewDto {
    return {
      id: plan.id,
      label: plan.label,
      priceInCents: plan.priceInCents,
    };
  }
}
