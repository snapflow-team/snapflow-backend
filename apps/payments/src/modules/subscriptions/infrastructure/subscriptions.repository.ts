import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@generated/prisma-payments';
import { CreatePendingOrderInfrastructureDto } from './types/create-pending-order.infrastructure-dto';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingOrder(
    data: CreatePendingOrderInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.subscription.create({
      data: {
        userId: data.userId,
        planId: data.planId,
        status: SubscriptionStatus.PENDING,
        payments: {
          create: {
            planId: data.planId,
            externalId: data.externalId,
            amount: data.amount,
            status: PaymentStatus.PENDING,
          },
        },
      },
    });
  }

  async activateSubscription(
    subscriptionId: number,
    stripeSubId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
