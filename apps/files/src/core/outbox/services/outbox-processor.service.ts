import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from '../../../modules/media-files/infrastructure/storage/storage.service';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxEvent, OutboxEventType } from '@generated/prisma-files';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../setup/configuration/configuration';
import { MicroserviceSettings } from '../../../setup/configuration/microservice.settings';

@Injectable()
export class OutboxProcessorService {
  private readonly logger: Logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async processOutboxEvents() {
    const pendingEvents: OutboxEvent[] = await this.outboxRepository.findPendingEvents(50);

    if (pendingEvents.length === 0) return;

    this.logger.log(`Found ${pendingEvents.length} pending outbox events. Processing...`);

    for (const event of pendingEvents) {
      try {
        const payload = event.payload as { key: string };

        if (event.type === OutboxEventType.DELETE_S3_FILE) {
          await this.storageService.deleteFile(payload.key);
        }

        await this.outboxRepository.markAsProcessed(event.id);
      } catch (error: any) {
        this.logger.error(`Failed to process event ${event.id}: ${error.message}`);

        await this.outboxRepository.updateWithError(event.id, error.message || 'Unknown S3 error');
      }
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
