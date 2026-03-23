import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxEventStatus, OutboxEventType, Prisma } from '@generated/prisma-files';
import { PrismaService } from '../../../../database/prisma.service'; // Твой путь к Prisma клиенту

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
        status: 'PENDING',
      },
    });
  }

  async findPendingEvents(limit: number = 50): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
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
