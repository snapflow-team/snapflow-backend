import { PaymentProvider } from '@generated/prisma-payments';
import { PaymentWithSubscription } from '../../types/payment-with-subscription.type';
import { Label } from '../../../../setup/configuration/business-rules-settings';

export class PaymentViewDto {
  userId: string;
  subscriptionId: string;
  dateOfPayment: string;
  endDateOfSubscription: string | null;
  price: number;
  subscriptionType: Label;
  provider: PaymentProvider;

  static mapToView(payment: PaymentWithSubscription): PaymentViewDto {
    const dto = new this();

    dto.userId = payment.subscription.userId.toString();
    dto.subscriptionId = payment.subscriptionId.toString();
    dto.dateOfPayment = payment.createdAt.toISOString();
    dto.endDateOfSubscription = payment.subscription.currentPeriodEnd?.toISOString() ?? null;
    dto.price = payment.amount;
    dto.subscriptionType =
      payment.planId === 'business_monthly' ? Label.BusinessMonthly : Label.BusinessYearly;
    dto.provider = payment.provider;

    return dto;
  }
}
