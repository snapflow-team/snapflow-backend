import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
  Prisma,
} from '@generated/prisma-snapflow';

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOutboxEvent(
    type: OutboxEventType,
    payload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        type,
        payload,
        status: OutboxEventStatus.PENDING,
      },
    });
  }

  async findPendingEvents(
    limit: number = 50,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OutboxEvent[]> {
    return tx.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsProcessed(id: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.PROCESSED,
        error: null,
      },
    });
  }

  async updateWithError(id: string, errorMessage: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        error: errorMessage,
      },
    });
  }

  async deleteProcessedEventsOlderThan(dateThreshold: Date): Promise<number> {
    const { count } = await this.prisma.outboxEvent.deleteMany({
      where: {
        status: OutboxEventStatus.PROCESSED,
        updatedAt: { lt: dateThreshold },
      },
    });

    return count;
  }
}
