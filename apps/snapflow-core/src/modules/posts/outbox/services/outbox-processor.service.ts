import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxEvent, OutboxEventType } from '@generated/prisma-snapflow';
import { OutboxRepository } from '../repositories/outbox.repository';
import { FilesClient } from '../../../integrations/files/files.client';
import { isDeletePostMediaFilePayload } from '../type-guards/outbox.type-guards';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { OutboxProcessing } from '../constants/outbox.constants';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';

@Injectable()
export class OutboxProcessorService {
  private isProcessing: boolean = false;
  private readonly logger: ContextLogger;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly filesClient: FilesClient,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(OutboxProcessorService.name);
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingEvents: OutboxEvent[] = await this.outboxRepository.lockEventsForProcessing(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );

      if (pendingEvents.length === 0) return;

      this.logger.log(
        `Found ${pendingEvents.length} pending outbox events. Processing...`,
        this.processOutboxEvents.name,
      );

      for (const event of pendingEvents) {
        try {
          if (event.type === OutboxEventType.DELETE_POST_MEDIA_FILE) {
            if (!isDeletePostMediaFilePayload(event.payload)) {
              throw new Error(`Invalid payload for event type ${event.type}`);
            }

            await this.filesClient.deleteFile({
              userId: event.payload.userId,
              fileUrl: event.payload.fileUrl,
            });
          }

          await this.outboxRepository.markAsProcessed(event.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown files service error';
          this.logger.error(error, `${this.processOutboxEvents.name}:eventId=${event.id}`);

          await this.outboxRepository.releaseToPending(event.id, message);
        }
      }
    } catch (error) {
      this.logger.error(error, this.processOutboxEvents.name);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleEvents() {
    try {
      const recoveredCount: number = await this.outboxRepository.recoverStaleEvents(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );

      if (recoveredCount > 0) {
        this.logger.warn(`Recovery: ${recoveredCount} stale events moved back to PENDING.`);
      }
    } catch (error) {
      this.logger.error(error, this.handleStaleEvents.name);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupProcessedEvents() {
    const { outboxRetentionDays } =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings');

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - outboxRetentionDays);

    const deletedCount: number =
      await this.outboxRepository.deleteProcessedEventsOlderThan(dateThreshold);

    if (deletedCount > 0) {
      this.logger.log(
        `Cleaned up ${deletedCount} processed outbox events older than ${outboxRetentionDays} days.`,
      );
    }
  }
}
