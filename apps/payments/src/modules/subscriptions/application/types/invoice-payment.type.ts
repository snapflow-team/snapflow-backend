import { PaymentProvider, PaymentStatus } from '@generated/prisma-payments';

export type InvoicePayment = {
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
};
