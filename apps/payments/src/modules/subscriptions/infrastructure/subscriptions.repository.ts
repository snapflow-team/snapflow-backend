import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AccountType,
  PaymentStatus,
  Prisma,
  Subscription,
  SubscriptionStatus,
} from '@generated/prisma-payments';
import { CreatePendingOrderInfrastructureDto } from './types/create-pending-order.infrastructure-dto';
import { BillingPeriod } from '../application/types/billing-period.type';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingOrder(
    data: CreatePendingOrderInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.subscription.create({
      data: {
        customerId: data.customerId,
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
    currentPeriod: BillingPeriod,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription> {
    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        stripeSubId,
        currentPeriodStart: currentPeriod.start,
        currentPeriodEnd: currentPeriod.end,
      },
    });
  }

  //todo(vitaliy) придумать более хорошее название методу который делает подписку протухшей после того как чекаут сессия протухла
  async cancelSubscription(
    subscriptionId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription> {
    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        autoRenewal: false,
      },
    });
  }

  async findByStripeSubscriptionId(
    stripeSubId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    return tx.subscription.findFirst({
      where: { stripeSubId, deletedAt: null },
    });
  }
  async setToPastDue(id: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        accountType: AccountType.PERSONAL,
      },
    });
  }
}
