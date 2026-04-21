import { Prisma } from '@generated/prisma-payments';

export type PaymentWithSubscription = Prisma.PaymentGetPayload<{
  include: {
    subscription: true;
  };
}>;
