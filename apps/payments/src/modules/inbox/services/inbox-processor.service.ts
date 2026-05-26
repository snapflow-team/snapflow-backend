import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InboxEvent } from '@generated/prisma-payments';
import Stripe from 'stripe';
import { InboxRepository } from '../repositories/inbox.repository';
import { InboxProcessing } from '../constants/inbox.constants';
import { WEBHOOK_HANDLERS } from '../../../core/providers/provide-tokens/webhook-handlers.inject-token';
import { WebhookHandler } from '../../subscriptions/application/webhook/webhook.handler';
import { PrismaService } from '../../database/prisma.service';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';
import { Notification } from '../../../common/notification/notification';
import { NotificationExceptionMapper } from '../../../common/notification/notification-exception.mapper';

@Injectable()
export class InboxProcessorService {
  private readonly logger: ContextLogger;
  private isProcessing: boolean = false;

  constructor(
    private readonly inboxRepository: InboxRepository,
    private readonly prisma: PrismaService,
    @Inject(WEBHOOK_HANDLERS) private readonly handlers: WebhookHandler[],
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(InboxProcessorService.name);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processInboxEvents(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const eventsToProcess: InboxEvent[] = await this.inboxRepository.lockEventsForProcessing(
        InboxProcessing.LOCK_BATCH_SIZE,
      );

      if (eventsToProcess.length === 0) return;

      this.logger.debug(
        `Picked ${eventsToProcess.length} inbox events for processing`,
        this.processInboxEvents.name,
      );

      for (const inboxEvent of eventsToProcess) {
        await this.processEvent(inboxEvent);
      }
    } catch (error) {
      this.logger.error(error, this.processInboxEvents.name);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleEvents(): Promise<void> {
    try {
      const recoveredCount: number = await this.inboxRepository.recoverStaleEvents(
        InboxProcessing.STALE_THRESHOLD_MINUTES,
      );

      if (recoveredCount > 0) {
        this.logger.warn(
          `Recovery: ${recoveredCount} stale inbox events moved back to PENDING.`,
          this.handleStaleEvents.name,
        );
      }
    } catch (error) {
      this.logger.error(error, this.handleStaleEvents.name);
    }
  }

  private async processEvent(inboxEvent: InboxEvent): Promise<void> {
    const startedAt: number = Date.now();
    const stripeEvent = inboxEvent.payload as unknown as Stripe.Event;

    try {
      const handler: WebhookHandler | undefined = this.handlers.find((item) =>
        item.supports(stripeEvent),
      );

      if (!handler) {
        this.logger.warn(
          `No handler for inbox event ${inboxEvent.eventId} type=${stripeEvent.type}. Marking as processed.`,
          this.processInboxEvents.name,
        );

        await this.inboxRepository.markAsProcessed(inboxEvent.eventId);

        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const result: Notification<void> = await handler.handle(stripeEvent, tx);

        if (result.hasErrors) {
          NotificationExceptionMapper.throw(result);
        }

        await this.inboxRepository.markAsProcessed(inboxEvent.eventId, tx);
      });

      this.logger.debug(
        `Event ${inboxEvent.eventId} type=${stripeEvent.type} processed in ${Date.now() - startedAt}ms`,
        this.processInboxEvents.name,
      );
    } catch (error) {
      const errorMessage: string = this.resolveErrorMessage(error, inboxEvent.eventId);

      this.logger.error(
        error instanceof Error ? error : new Error(errorMessage),
        this.processInboxEvents.name,
      );

      await this.inboxRepository.markAsFailed(
        inboxEvent.eventId,
        errorMessage,
        inboxEvent.attempts,
      );

      const nextAttempts: number = inboxEvent.attempts + 1;
      this.logger.warn(
        `Event ${inboxEvent.eventId} failed (attempts ${nextAttempts}/${InboxProcessing.MAX_ATTEMPTS}): ${errorMessage}`,
        this.processInboxEvents.name,
      );
    }
  }

  private resolveErrorMessage(error: unknown, eventId: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    return `Unknown error while processing inbox event ${eventId}`;
  }
}
