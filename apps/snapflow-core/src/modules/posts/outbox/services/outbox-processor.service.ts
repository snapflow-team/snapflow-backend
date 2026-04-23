import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxEvent, OutboxEventType } from '@generated/prisma-snapflow';
import { OutboxRepository } from '../repositories/outbox.repository';
import { FilesClient } from '../../../integrations/files/files.client';
import { isDeletePostMediaFilePayload } from '../type-guards/outbox.type-guards';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';

@Injectable()
export class OutboxProcessorService {
  private readonly logger: Logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly filesClient: FilesClient,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  // todo(vilyamz): разрешить вопрос с конкуренцией при нескольких инстансах

  @Cron(CronExpression.EVERY_30_MINUTES)
  async processOutboxEvents() {
    const pendingEvents: OutboxEvent[] = await this.outboxRepository.findPendingEvents(50);

    if (pendingEvents.length === 0) return;

    this.logger.log(`Found ${pendingEvents.length} pending outbox events. Processing...`);

    for (const event of pendingEvents) {
      try {
        if (event.type === OutboxEventType.DELETE_POST_MEDIA_FILE) {
          if (!isDeletePostMediaFilePayload(event.payload)) {
            // vilyamz: уместно ли тут выкидывать ошибку через new Error? Или лучше доменное искличение с 500?
            throw new Error(`Invalid payload for event type ${event.type}`);
          }

          await this.filesClient.deleteFile({
            userId: event.payload.userId,
            fileUrl: event.payload.fileUrl,
          });
        }

        await this.outboxRepository.markAsProcessed(event.id);
      } catch (error: any) {
        const message = error?.message || 'Unknown files service error';
        this.logger.error(`Failed to process event ${event.id}: ${message}`);

        await this.outboxRepository.updateWithError(event.id, message);
      }
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
