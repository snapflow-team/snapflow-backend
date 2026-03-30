import { Injectable } from '@nestjs/common';
import { OutboxEventStatus, OutboxEventType, Prisma } from '@generated/prisma-payments';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OutboxRepository {
  constructor(private prisma: PrismaService) {}

  async saveEvent(type: OutboxEventType, payload: any, tx: Prisma.TransactionClient = this.prisma) {
    return tx.outboxEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
      },
    });
  }
}
