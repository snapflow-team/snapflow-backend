import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxEvent } from '@generated/prisma-payments';
import { OutboxProcessing } from '../constants/outbox.constants';
import { RabbitMQPublisherService } from '../../rabbitmq/rabbitmq-publisher.service';
import { PAYMENTS_EXCHANGE } from '../../../../../../libs/contracts/payments';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';

@Injectable()
export class OutboxProcessorService {
  private readonly logger: ContextLogger;
  private isProcessing: boolean = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly rabbitPublisher: RabbitMQPublisherService,
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

      this.logger.debug(
        `Found ${eventsToProcess.length} pending outbox events. Processing...`,
        this.processOutboxEvents.name,
      );

      for (const event of eventsToProcess) {
        try {
          await this.rabbitPublisher.publish(PAYMENTS_EXCHANGE, event.type, event.payload);

          await this.outboxRepository.markAsProcessed(event.id);
        } catch (error) {
          const errorMessage: string =
            error instanceof Error ? error.message : 'Unknown broker error';
          this.logger.error(
            error instanceof Error ? error : new Error(errorMessage),
            this.processOutboxEvents.name,
          );

          await this.outboxRepository.markAsFailed(event.id, errorMessage);
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
}
