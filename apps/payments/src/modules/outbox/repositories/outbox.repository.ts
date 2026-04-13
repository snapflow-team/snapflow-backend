import { Injectable } from '@nestjs/common';
import { OutboxEvent, OutboxEventStatus, OutboxEventType, Prisma, } from '@generated/prisma-payments';
import { PrismaService } from '../../database/prisma.service';
import { OutboxProcessing } from '../constants/outbox.constants';

@Injectable()
export class OutboxRepository {
  constructor(private prisma: PrismaService) {}

  async saveEvent(
    type: OutboxEventType,
    payload: any,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OutboxEvent> {
    return tx.outboxEvent.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
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
