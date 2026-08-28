import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StorageOutboxEvent,
  StorageOutboxEventStatus,
  StorageOutboxEventType,
} from '@generated/prisma-files';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class StorageOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(
    type: StorageOutboxEventType,
    payload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const event = await tx.storageOutboxEvent.create({
      data: {
        type,
        payload,
        status: StorageOutboxEventStatus.PENDING,
      },
    });

    return event.id;
  }

  async lockEventsForProcessing(limit: number): Promise<StorageOutboxEvent[]> {
    return this.prisma.$queryRaw<StorageOutboxEvent[]>`
      UPDATE "storage_outbox_events"
      SET
        "status" = ${StorageOutboxEventStatus.PROCESSING}::"StorageOutboxEventStatus",
        "updated_at" = NOW(),
        "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "storage_outbox_events"
        WHERE "status" = ${StorageOutboxEventStatus.PENDING}::"StorageOutboxEventStatus"
          AND "available_at" <= NOW()
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.storageOutboxEvent.update({
      where: { id },
      data: {
        status: StorageOutboxEventStatus.PROCESSED,
        processedAt: new Date(),
        error: null,
      },
    });
  }

  async releaseToPending(id: string, errorMessage: string, delayMs = 5000): Promise<void> {
    const availableAt = new Date(Date.now() + delayMs);

    await this.prisma.storageOutboxEvent.update({
      where: { id },
      data: {
        status: StorageOutboxEventStatus.PENDING,
        error: errorMessage,
        availableAt,
      },
    });
  }

  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.storageOutboxEvent.update({
      where: { id },
      data: {
        status: StorageOutboxEventStatus.FAILED,
        error: errorMessage,
      },
    });
  }

  async recoverStaleEvents(staleThresholdMinutes: number): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "storage_outbox_events"
      SET "status" = ${StorageOutboxEventStatus.PENDING}::"StorageOutboxEventStatus"
      WHERE "status" = ${StorageOutboxEventStatus.PROCESSING}::"StorageOutboxEventStatus"
        AND "updated_at" < NOW() - make_interval(mins => ${staleThresholdMinutes});
    `;
  }
}
