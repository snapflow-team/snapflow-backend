import { IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export interface Plan {
  id: string;
  label: string;
  priceInCents: number;
  stripePriceId: string;
}

export class BusinessRulesSettings {
  @IsString()
  stripePriceBusinessMonthly: string;

  @IsString()
  stripePriceBusinessYearly: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.stripePriceBusinessMonthly = environmentVariables.STRIPE_PRICE_BUSINESS_MONTHLY;
    this.stripePriceBusinessYearly = environmentVariables.STRIPE_PRICE_BUSINESS_YEARLY;
  }

  get plans(): Plan[] {
    return [
      {
        id: 'business_monthly',
        label: 'Business Monthly',
        priceInCents: 1000,
        stripePriceId: this.stripePriceBusinessMonthly,
      },
      {
        id: 'business_yearly',
        label: 'Business Yearly',
        priceInCents: 9000,
        stripePriceId: this.stripePriceBusinessYearly,
      },
    ];
  }
}
