import { PaymentProvider } from '@generated/prisma-payments';

export class PaymentViewDto {
  userId: string;
  subscriptionId: string;
  dateOfPayment: string;
  endDateOfSubscription: string;
  price: number;
  // vilyamz: subscriptionType вынести в enum
  subscriptionType: string;
  provider: PaymentProvider;
}
