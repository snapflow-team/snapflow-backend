import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxCommand, OutboxCommandType } from '@generated/prisma-payments';
import { OutboxCommandRepository } from '../repositories/outbox-command.repository';
import { OutboxCommandProcessing } from '../constants/outbox-command.constants';
import { StripeExtendSubscriptionExecutor } from '../executors/stripe-extend-subscription.executor';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';

@Injectable()
export class OutboxCommandProcessorService {
  private readonly logger: ContextLogger;
  private isProcessing = false;

  constructor(
    private readonly outboxCommandRepository: OutboxCommandRepository,
    private readonly stripeExtendSubscriptionExecutor: StripeExtendSubscriptionExecutor,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(OutboxCommandProcessorService.name);
  }

  @Cron('*/15 * * * * *')
  async processOutboxCommands(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const commandsToProcess: OutboxCommand[] =
        await this.outboxCommandRepository.lockCommandsForProcessing(
          OutboxCommandProcessing.LOCK_BATCH_SIZE,
        );

      if (commandsToProcess.length === 0) return;

      this.logger.debug(
        `Picked ${commandsToProcess.length} outbox commands for processing`,
        this.processOutboxCommands.name,
      );

      for (const command of commandsToProcess) {
        await this.processCommand(command);
      }
    } catch (error) {
      this.logger.error(error, this.processOutboxCommands.name);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleCommands(): Promise<void> {
    try {
      const recoveredCount: number = await this.outboxCommandRepository.recoverStaleCommands(
        OutboxCommandProcessing.STALE_THRESHOLD_MINUTES,
      );

      if (recoveredCount > 0) {
        this.logger.warn(
          `Recovery: ${recoveredCount} stale outbox commands moved back to PENDING.`,
          this.handleStaleCommands.name,
        );
      }
    } catch (error) {
      this.logger.error(error, this.handleStaleCommands.name);
    }
  }

  private async processCommand(command: OutboxCommand): Promise<void> {
    const startedAt: number = Date.now();

    try {
      this.logger.debug(
        `Executing outbox command ${command.id} type=${command.type} idempotencyKey=${command.id}`,
        this.processOutboxCommands.name,
      );

      await this.executeByType(command);

      await this.outboxCommandRepository.markAsProcessed(command.id);

      this.logger.debug(
        `Outbox command ${command.id} type=${command.type} processed in ${Date.now() - startedAt}ms`,
        this.processOutboxCommands.name,
      );
    } catch (error) {
      const errorMessage = this.resolveErrorMessage(error, command.id);

      this.logger.error(
        error instanceof Error ? error : new Error(errorMessage),
        this.processOutboxCommands.name,
      );

      await this.outboxCommandRepository.markAsFailed(command.id, errorMessage, command.attempts);

      const nextAttempts = command.attempts + 1;
      this.logger.warn(
        `Outbox command ${command.id} failed (attempts ${nextAttempts}/${OutboxCommandProcessing.MAX_ATTEMPTS}): ${errorMessage}`,
        this.processOutboxCommands.name,
      );
    }
  }

  private async executeByType(command: OutboxCommand): Promise<void> {
    switch (command.type) {
      case OutboxCommandType.STRIPE_EXTEND_SUBSCRIPTION:
        await this.stripeExtendSubscriptionExecutor.execute(command);
        return;
      default:
        throw new Error(`Unsupported outbox command type: ${command.type}`);
    }
  }

  private resolveErrorMessage(error: unknown, commandId: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    return `Unknown error while processing outbox command ${commandId}`;
  }
}
