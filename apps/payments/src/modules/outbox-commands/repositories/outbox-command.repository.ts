import { Injectable } from '@nestjs/common';
import {
  OutboxCommand,
  OutboxCommandStatus,
  OutboxCommandType,
  Prisma,
} from '@generated/prisma-payments';
import { PrismaService } from '../../database/prisma.service';
import { OutboxCommandProcessing } from '../constants/outbox-command.constants';

@Injectable()
export class OutboxCommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveCommand(
    type: OutboxCommandType,
    payload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OutboxCommand> {
    return tx.outboxCommand.create({
      data: {
        type,
        payload,
        status: OutboxCommandStatus.PENDING,
      },
    });
  }

  async lockCommandsForProcessing(
    limit: number = OutboxCommandProcessing.LOCK_BATCH_SIZE,
  ): Promise<OutboxCommand[]> {
    return this.prisma.$queryRaw<OutboxCommand[]>`
      UPDATE "outbox_commands"
      SET
        "status" = ${OutboxCommandStatus.PROCESSING},
        "updated_at" = NOW()
      WHERE "id" IN (
        SELECT "id" FROM "outbox_commands"
        WHERE "status" = ${OutboxCommandStatus.PENDING}
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
  }

  async recoverStaleCommands(
    staleThresholdMinutes: number = OutboxCommandProcessing.STALE_THRESHOLD_MINUTES,
  ): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "outbox_commands"
      SET "status" = ${OutboxCommandStatus.PENDING}
      WHERE "status" = ${OutboxCommandStatus.PROCESSING}
        AND "updated_at" < NOW() - make_interval(mins => ${staleThresholdMinutes});
    `;
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.outboxCommand.update({
      where: { id },
      data: {
        status: OutboxCommandStatus.PROCESSED,
        processedAt: new Date(),
        error: null,
      },
    });
  }

  async markAsFailed(id: string, error: string, attempts: number): Promise<void> {
    const nextAttempts = attempts + 1;
    const status =
      nextAttempts >= OutboxCommandProcessing.MAX_ATTEMPTS
        ? OutboxCommandStatus.FAILED
        : OutboxCommandStatus.PENDING;

    await this.prisma.outboxCommand.update({
      where: { id },
      data: {
        status,
        attempts: nextAttempts,
        error,
      },
    });
  }
}
