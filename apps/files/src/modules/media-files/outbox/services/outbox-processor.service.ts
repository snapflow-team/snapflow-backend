import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxEvent, OutboxEventType } from '@generated/prisma-files';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { MicroserviceSettings } from '../../../../setup/configuration/microservice.settings';
import { OutboxProcessing } from '../constants/outbox.constants';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';

@Injectable()
export class OutboxProcessorService {
  private readonly logger: ContextLogger;
  private isProcessing: boolean = false;

  constructor(
    private readonly storageService: StorageService,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(OutboxProcessorService.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const eventsToProcess: OutboxEvent[] = await this.outboxRepository.lockEventsForProcessing(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );

      if (eventsToProcess.length === 0) return;

      this.logger.log(
        `Found ${eventsToProcess.length} pending outbox events. Processing...`,
        this.processOutboxEvents.name,
      );

      for (const event of eventsToProcess) {
        try {
          const payload = event.payload as { key: string };

          if (event.type === OutboxEventType.DELETE_S3_FILE) {
            await this.storageService.deleteFile(payload.key);
          }

          await this.outboxRepository.markAsProcessed(event.id);
        } catch (error) {
          const errorMessage: string = error instanceof Error ? error.message : 'Unknown S3 error';
          this.logger.error(
            error instanceof Error ? error : new Error(errorMessage),
            this.processOutboxEvents.name,
          );

          await this.outboxRepository.releaseToPending(event.id, errorMessage);
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
        this.logger.warn(
          `Recovery: ${recoveredCount} stale events moved back to PENDING.`,
          this.handleStaleEvents.name,
        );
      }
    } catch (error) {
      this.logger.error(error, this.handleStaleEvents.name);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupProcessedEvents() {
    const { outboxRetentionDays } =
      this.configService.get<MicroserviceSettings>('microserviceSettings');

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - outboxRetentionDays);

    const deletedCount: number =
      await this.outboxRepository.deleteProcessedEventsOlderThan(dateThreshold);

    if (deletedCount > 0) {
      this.logger.log(
        `Cleaned up ${deletedCount} processed outbox events older than ${outboxRetentionDays} days.`,
        this.cleanupProcessedEvents.name,
      );
    }
  }
}
