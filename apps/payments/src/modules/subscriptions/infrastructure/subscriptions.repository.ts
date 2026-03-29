import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus, Prisma, SubscriptionStatus } from '@generated/prisma-payments';
import { CreatePendingOrderInfrastructureDto } from './types/create-pending-order.infrastructure-dto';

@Injectable()
export class SubscriptionsRepository {
  constructor(private prisma: PrismaService) {}

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

  // async completeOrder(externalId: string, stripeSubId: string, tx: any = this.prisma) {
  //   const payment = await tx.payment.findFirst({ where: { externalId } });
  //   if (!payment) throw new Error(`Payment with externalId ${externalId} not found`);
  //
  //   await tx.payment.update({
  //     where: { id: payment.id },
  //     data: { status: 'PAID' },
  //   });
  //
  //   return tx.subscription.update({
  //     where: { id: payment.subscriptionId },
  //     data: {
  //       status: 'ACTIVE',
  //       stripeSubId,
  //       currentPeriodStart: new Date(),
  //       currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // + 30 дней (упрощенно)
  //     },
  //   });
  // }
}
