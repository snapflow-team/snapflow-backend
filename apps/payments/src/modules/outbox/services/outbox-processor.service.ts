import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxEvent } from '@generated/prisma-payments';
import { OutboxProcessing } from '../constants/outbox.constants';
import { RabbitMQPublisherService } from './rabbitmq-publisher.service';
import { PAYMENTS_EXCHANGE } from '../../../../../../libs/contracts/payments';

@Injectable()
export class OutboxProcessorService {
  private readonly logger: Logger = new Logger(OutboxProcessorService.name);
  private isProcessing: boolean = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly rabbitPublisher: RabbitMQPublisherService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const eventsToProcess: OutboxEvent[] = await this.outboxRepository.lockEventsForProcessing(
        OutboxProcessing.LOCK_BATCH_SIZE,
      );

      if (eventsToProcess.length === 0) return;

      this.logger.debug(`Found ${eventsToProcess.length} pending outbox events. Processing...`);

      for (const event of eventsToProcess) {
        try {
          await this.rabbitPublisher.publish(PAYMENTS_EXCHANGE, event.type, event.payload);

          await this.outboxRepository.markAsProcessed(event.id);
        } catch (error) {
          const errorMessage: string =
            error instanceof Error ? error.message : 'Unknown broker error';
          this.logger.error(`Failed to publish event ${event.id}: ${errorMessage}`);

          await this.outboxRepository.markAsFailed(event.id, errorMessage);
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
}
