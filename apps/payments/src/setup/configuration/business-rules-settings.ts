import { IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export interface Plan {
  id: string;
  label: Label;
  priceInCents: number;
  stripePriceId: string;
}

export enum Label {
  BusinessMonthly = 'Business Monthly',
  BusinessYearly = 'Business Yearly',
}

export class BusinessRulesSettings {
  @IsString()
  stripePriceIdBusinessMonthly: string;

  @IsString()
  stripePriceIdBusinessYearly: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.stripePriceIdBusinessMonthly = environmentVariables.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
    this.stripePriceIdBusinessYearly = environmentVariables.STRIPE_PRICE_ID_BUSINESS_YEARLY;
  }

  get plans(): Plan[] {
    return [
      {
        id: 'business_monthly',
        label: Label.BusinessMonthly,
        priceInCents: 1000,
        stripePriceId: this.stripePriceIdBusinessMonthly,
      },
      {
        id: 'business_yearly',
        label: Label.BusinessYearly,
        priceInCents: 9000,
        stripePriceId: this.stripePriceIdBusinessYearly,
      },
    ];
  }
}
