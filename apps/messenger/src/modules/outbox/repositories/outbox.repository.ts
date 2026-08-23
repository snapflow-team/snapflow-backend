import { Injectable } from '@nestjs/common';
import {
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
  Prisma,
} from '@generated/prisma-messenger';
import { PrismaService } from '../../database/prisma.service';
import { OutboxProcessing } from '../constants/outbox.constants';

@Injectable()
export class OutboxRepository {
  constructor(private prisma: PrismaService) {}

  async saveEvent(
    type: OutboxEventType,
    payload: unknown,
    availableAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OutboxEvent> {
    return tx.outboxEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
        availableAt,
      },
    });
  }

  async lockEventsForProcessing(
    type: OutboxEventType,
    limit: number = OutboxProcessing.LOCK_BATCH_SIZE,
  ): Promise<OutboxEvent[]> {
    return this.prisma.$queryRaw<OutboxEvent[]>`
      UPDATE "outbox_events"
      SET
        "status" = ${OutboxEventStatus.PROCESSING},
        "updated_at" = NOW()
      WHERE "id" IN (
        SELECT "id" FROM "outbox_events"
        WHERE "status" = ${OutboxEventStatus.PENDING}
          AND "type" = ${type}::"OutboxEventType"
          AND "available_at" <= NOW()
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
  }

  async recoverStaleEvents(
    staleThresholdMinutes: number = OutboxProcessing.STALE_THRESHOLD_MINUTES,
  ): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "outbox_events"
      SET "status" = ${OutboxEventStatus.PENDING}
      WHERE "status" = ${OutboxEventStatus.PROCESSING}
        AND "updated_at" < NOW() - make_interval(mins => ${staleThresholdMinutes});
    `;
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.PROCESSED, error: null },
    });
  }

  async markAsSkipped(id: string, reason: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.SKIPPED, error: reason },
    });
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxEventStatus.FAILED, error },
    });
  }

  async releaseToPending(id: string, errorMessage: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.PENDING,
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
