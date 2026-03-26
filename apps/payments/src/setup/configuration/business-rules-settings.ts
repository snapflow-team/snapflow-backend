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
        label: 'Business Monthly',
        priceInCents: 1000,
        stripePriceId: this.stripePriceIdBusinessMonthly,
      },
      {
        id: 'business_yearly',
        label: 'Business Yearly',
        priceInCents: 9000,
        stripePriceId: this.stripePriceIdBusinessYearly,
      },
    ];
  }
}
