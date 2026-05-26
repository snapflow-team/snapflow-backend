import { Injectable } from '@nestjs/common';
import { InboxEvent, InboxEventStatus, PaymentProvider, Prisma } from '@generated/prisma-payments';
import { PrismaService } from '../../database/prisma.service';
import { InboxProcessing } from '../constants/inbox.constants';
import Stripe from 'stripe';

@Injectable()
export class InboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async tryInsertEvent(event: Stripe.Event): Promise<boolean> {
    try {
      await this.prisma.inboxEvent.create({
        data: {
          eventId: event.id,
          provider: PaymentProvider.STRIPE,
          payload: event as unknown as Prisma.InputJsonValue,
          status: InboxEventStatus.PENDING,
        },
      });

      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }

      throw error;
    }
  }

  async lockEventsForProcessing(
    limit: number = InboxProcessing.LOCK_BATCH_SIZE,
  ): Promise<InboxEvent[]> {
    return this.prisma.$queryRaw<InboxEvent[]>`
      UPDATE "inbox_events"
      SET
        "status" = ${InboxEventStatus.PROCESSING},
        "updated_at" = NOW()
      WHERE "event_id" IN (
        SELECT "event_id" FROM "inbox_events"
        WHERE "status" = ${InboxEventStatus.PENDING}
        ORDER BY "received_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        "event_id" AS "eventId",
        "provider",
        "payload",
        "status",
        "attempts",
        "error",
        "received_at" AS "receivedAt",
        "processed_at" AS "processedAt",
        "updated_at" AS "updatedAt";
    `;
  }

  async recoverStaleEvents(
    staleThresholdMinutes: number = InboxProcessing.STALE_THRESHOLD_MINUTES,
  ): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "inbox_events"
      SET "status" = ${InboxEventStatus.PENDING}
      WHERE "status" = ${InboxEventStatus.PROCESSING}
        AND "updated_at" < NOW() - make_interval(mins => ${staleThresholdMinutes});
    `;
  }

  async markAsProcessed(
    eventId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.inboxEvent.update({
      where: { eventId },
      data: {
        status: InboxEventStatus.PROCESSED,
        processedAt: new Date(),
        error: null,
      },
    });
  }

  async markAsFailed(eventId: string, error: string, attempts: number): Promise<void> {
    const nextAttempts = attempts + 1;
    const status =
      nextAttempts >= InboxProcessing.MAX_ATTEMPTS
        ? InboxEventStatus.FAILED
        : InboxEventStatus.PENDING;

    await this.prisma.inboxEvent.update({
      where: { eventId },
      data: {
        status,
        attempts: nextAttempts,
        error,
      },
    });
  }
}
