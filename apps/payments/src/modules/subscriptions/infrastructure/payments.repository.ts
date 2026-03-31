import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaymentStatus, Prisma } from '@generated/prisma-payments';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(externalId: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.payment.findFirst({
      where: { externalId },
    });
  }

  async markAsPaid(paymentId: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID },
    });
  }
}
