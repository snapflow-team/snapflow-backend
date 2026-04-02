import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxEventStatus, OutboxEventType, Prisma, } from '@generated/prisma-payments';
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

  async getPendingBatchAndLock(limit: number = 50): Promise<OutboxEvent[]> {
    return this.prisma.$queryRaw<OutboxEvent[]>`
      SELECT * FROM "outbox_events"
      WHERE status = ${OutboxEventStatus.PENDING}
      ORDER BY "created_at" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED;
    `;
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.PROCESSED },
    });
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.FAILED, error },
    });
  }
}
