import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Payment, PaymentStatus, Prisma } from '@generated/prisma-payments';
import { CreateSucceededPaymentInfrastructureDto } from './types/create-succeeded-payment.infrastructure-dto';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(
    externalId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Payment | null> {
    return tx.payment.findFirst({
      where: { externalId },
    });
  }

  async createSucceededPayment(
    dto: CreateSucceededPaymentInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Payment> {
    return tx.payment.create({
      data: {
        amount: dto.amount,
        subscriptionId: dto.subscriptionId,
        planId: dto.planId,
        status: PaymentStatus.PAID,
      },
    });
  }

  async markAsPaid(
    paymentId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Payment> {
    return tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID },
    });
  }

  async markAsFailed(
    paymentId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Payment> {
    return tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED },
    });
  }
}
