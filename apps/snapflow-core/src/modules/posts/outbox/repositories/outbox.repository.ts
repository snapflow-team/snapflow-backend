import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import {
  OutboxEvent,
  OutboxEventStatus,
  OutboxEventType,
  Prisma,
} from '@generated/prisma-snapflow';
import { OutboxProcessing } from '../constants/outbox.constants';

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

  async lockEventsForProcessing(
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
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
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

  async releaseToPending(id: string, errorMessage: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.PENDING,
        error: errorMessage,
      },
    });
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
