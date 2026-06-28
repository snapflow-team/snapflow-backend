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
import { ActivateSubscriptionDto } from '../application/dto/activate-subscription-webhook.application-dto';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStripeSubscriptionId(
    stripeSubId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    return tx.subscription.findFirst({
      where: { stripeSubId, deletedAt: null },
    });
  }
  async findById(
    subscriptionId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    return tx.subscription.findFirst({
      where: { id: subscriptionId, deletedAt: null },
    });
  }

  async findByIdWithCustomerOrThrow(
    subscriptionId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.subscription.findFirstOrThrow({
      where: { id: subscriptionId, deletedAt: null },
      include: {
        customer: true,
      },
    });
  }

  async findActiveOrPastDueByUserId(userId: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.subscription.findFirst({
      where: {
        customer: {
          userId,
        },
        OR: [{ status: SubscriptionStatus.ACTIVE }, { status: SubscriptionStatus.PAST_DUE }],
        deletedAt: null,
      },
    });
  }

  async findLastByUserId(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    return tx.subscription.findFirst({
      where: {
        customer: {
          userId,
        },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

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

  async updateAutoRenewal(
    subscriptionId: number,
    autoRenewal: boolean,
    nextPaymentAt: Date | null,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription> {
    return tx.subscription.update({
      where: { id: subscriptionId, deletedAt: null },
      data: {
        autoRenewal,
        nextPaymentAt,
      },
    });
  }

  async activateSubscription(
    dto: ActivateSubscriptionDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    return tx.subscription.update({
      where: { id: dto.subscriptionId },
      data: {
        accountType: AccountType.BUSINESS,
        status: SubscriptionStatus.ACTIVE,
        stripeSubId: dto.stripeSubId,
        currentPeriodStart: dto.currentPeriod.start,
        currentPeriodEnd: dto.currentPeriod.end,
        lastStripeEventAt: dto.lastStripeEventAt,
        nextPaymentAt: dto.currentPeriod.end,

        customer: {
          update: {
            stripeCusId: dto.stripeCusId,
          },
        },
      },
    });
  }

  async cancelSubscription(
    subscriptionId: number,
    lastStripeEventAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    // vilyamz,vitaliy[payments]: нормально ли то, что мы выполняем два запроса в бд в рамках одного метода?
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return null;
    }
    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        autoRenewal: false,
        nextPaymentAt: null,
        lastStripeEventAt,
      },
    });
  }

  async setToPastDue(
    subscriptionId: number,
    nextPaymentAt: Date | null,
    lastStripeEventAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return false;
    }
    const result = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        accountType: AccountType.PERSONAL,
        nextPaymentAt,
        lastStripeEventAt,
      },
    });
    return !!result;
  }

  //Метод для автопродления подписки страйпом автоматически по истечении периода подписки(autoRenewal: true)
  async renewSubscription(
    subscriptionId: number,
    period: BillingPeriod,
    lastStripeEventAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return null;
    }
    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        nextPaymentAt: period.end,
        lastStripeEventAt,
      },
    });
  }

  //Этот метод используется для продления активной подписки покупке пользователем еще подписки
  async extendSubscription(
    subscriptionId: number,
    newEnd: Date,
    lastStripeEventAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Subscription | null> {
    return tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodEnd: newEnd,
        nextPaymentAt: newEnd,
        lastStripeEventAt,
      },
    });
  }
}
