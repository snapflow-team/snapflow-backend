import { IsString } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export interface Plan {
  id: string;
  label: Label;
  priceInCents: number;
  stripeSubscriptionPriceId: string;
  stripeOnePayPriceId: string;
  subscriptionDurationInDays: number;
}

export enum Label {
  BusinessMonthly = 'Business Monthly',
  BusinessYearly = 'Business Yearly',
}

export class BusinessRulesSettings {
  private plans: Plan[];

  @IsString()
  stripePriceIdBusinessMonthly: string;

  @IsString()
  stripePriceIdBusinessMonthlyOnePay: string;

  @IsString()
  stripePriceIdBusinessYearly: string;

  @IsString()
  stripePriceIdBusinessYearlyOnePay: string;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.stripePriceIdBusinessMonthly = environmentVariables.STRIPE_PRICE_ID_BUSINESS_MONTHLY;
    this.stripePriceIdBusinessMonthlyOnePay =
      environmentVariables.STRIPE_PRICE_ID_BUSINESS_MONTHLY_ONE_PAY;
    this.stripePriceIdBusinessYearly = environmentVariables.STRIPE_PRICE_ID_BUSINESS_YEARLY;
    this.stripePriceIdBusinessYearlyOnePay =
      environmentVariables.STRIPE_PRICE_ID_BUSINESS_YEARLY_ONE_PAY;

    this.initializeProducts();
  }
  private initializeProducts(): void {
    this.plans = [
      {
        id: 'business_monthly',
        label: Label.BusinessMonthly,
        priceInCents: 1000,
        stripeSubscriptionPriceId: this.stripePriceIdBusinessMonthly,
        stripeOnePayPriceId: this.stripePriceIdBusinessMonthlyOnePay,
        subscriptionDurationInDays: 30,
      },
      {
        id: 'business_yearly',
        label: Label.BusinessYearly,
        priceInCents: 9000,
        stripeSubscriptionPriceId: this.stripePriceIdBusinessYearly,
        stripeOnePayPriceId: this.stripePriceIdBusinessYearlyOnePay,
        subscriptionDurationInDays: 30 * 12,
      },
    ];
  }

  getPlans(): Plan[] {
    return this.plans;
  }
}
