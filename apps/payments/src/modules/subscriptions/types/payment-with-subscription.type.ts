import { Prisma } from '@generated/prisma-payments';

export type PaymentWithSubscriptionAndCustomer = Prisma.PaymentGetPayload<{
  include: {
    subscription: {
      include: {
        customer: true;
      };
    };
  };
}>;
