import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OutboxRepository } from '../repositories/outbox.repository';
import { OutboxProcessing } from '../constants/outbox.constants';
import { Configuration } from '../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../setup/configuration/business-rules-settings';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';

@Injectable()
export class OutboxMaintenanceService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(OutboxMaintenanceService.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverStaleEvents() {
    try {
      const recoveredCount: number = await this.outboxRepository.recoverStaleEvents(
        OutboxProcessing.STALE_THRESHOLD_MINUTES,
      );

      if (recoveredCount > 0) {
        this.logger.warn(
          `Recovery: ${recoveredCount} stale events moved back to PENDING.`,
          this.recoverStaleEvents.name,
        );
      }
    } catch (error) {
      this.logger.error(error, this.recoverStaleEvents.name);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanup() {
    try {
      const { outboxRetentionDays } =
        this.configService.get<BusinessRulesSettings>('businessRulesSettings');

      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - outboxRetentionDays);

      const deletedCount: number =
        await this.outboxRepository.deleteProcessedEventsOlderThan(dateThreshold);

      if (deletedCount > 0) {
        this.logger.log(
          `Cleaned up ${deletedCount} processed outbox events older than ${outboxRetentionDays} days.`,
          this.cleanup.name,
        );
      }
    } catch (error) {
      this.logger.error(error, this.cleanup.name);
    }
  }
}
