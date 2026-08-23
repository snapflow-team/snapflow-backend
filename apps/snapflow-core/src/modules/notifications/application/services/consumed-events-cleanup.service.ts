import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { ConsumedEventsRepository } from '../../infrastructure/consumed-events.repository';

@Injectable()
export class ConsumedEventsCleanupService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly consumedEventsRepository: ConsumedEventsRepository,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(ConsumedEventsCleanupService.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDeleteOldConsumedEvents(): Promise<void> {
    try {
      const { consumedEventsRetentionDays }: BusinessRulesSettings =
        this.configService.get<BusinessRulesSettings>('businessRulesSettings');

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - consumedEventsRetentionDays);

      const deletedCount: number = await this.consumedEventsRepository.deleteOlderThan(cutoff);

      if (deletedCount > 0) {
        this.logger.log(
          `Deleted ${deletedCount} consumed events older than ${consumedEventsRetentionDays} days`,
          this.handleDeleteOldConsumedEvents.name,
        );
      }
    } catch (error) {
      this.logger.error(error, this.handleDeleteOldConsumedEvents.name);
    }
  }
}
