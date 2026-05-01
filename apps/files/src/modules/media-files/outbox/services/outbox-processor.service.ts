import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxEvent, OutboxEventType } from '@generated/prisma-files';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { MicroserviceSettings } from '../../../../setup/configuration/microservice.settings';
import { OutboxProcessing } from '../constants/outbox.constants';

@Injectable()
export class OutboxProcessorService {
  private readonly logger: Logger = new Logger(OutboxProcessorService.name);
  private isProcessing: boolean = false;

  constructor(
    private readonly storageService: StorageService,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  @Cron(CronExpression.EVERY_10_HOURS)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const eventsToProcess: OutboxEvent[] = await this.outboxRepository.lockEventsForProcessing(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );

      if (eventsToProcess.length === 0) return;

      this.logger.log(`Found ${eventsToProcess.length} pending outbox events. Processing...`);

      for (const event of eventsToProcess) {
        try {
          const payload = event.payload as { key: string };

          if (event.type === OutboxEventType.DELETE_S3_FILE) {
            await this.storageService.deleteFile(payload.key);
          }

          await this.outboxRepository.markAsProcessed(event.id);
        } catch (error) {
          const errorMessage: string = error instanceof Error ? error.message : 'Unknown S3 error';
          this.logger.error(`Failed to process event ${event.id}: ${errorMessage}`);

          await this.outboxRepository.releaseToPending(event.id, errorMessage);
        }
      }
    } catch (error) {
      this.logger.error(
        'Critical failure in outbox processor loop',
        error instanceof Error ? error.stack : '',
      );
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
      this.logger.error('Failed to recover stale events', error);
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
      );
    }
  }
}
