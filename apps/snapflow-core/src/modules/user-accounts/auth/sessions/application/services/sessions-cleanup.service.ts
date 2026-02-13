import { Injectable, Logger } from '@nestjs/common';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { Cron } from '@nestjs/schedule';
import { UserAccountsConfig } from '../../../../config/user-accounts.config';

@Injectable()
export class SessionsCleanupService {
  private readonly logger: Logger = new Logger(SessionsCleanupService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly userAccountsConfig: UserAccountsConfig,
  ) {}

  @Cron('0 3 * * *')
  async handHardDeleteOldSessions(): Promise<void> {
    try {
      this.logger.debug('Starting hard delete job for old soft-deleted sessions...');

      const deletedCount: number = await this.sessionsRepository.hardDeleteOldSoftDeletedSessions(
        this.userAccountsConfig.sessionCleanupRetentionDays,
      );

      this.logger.log(
        `Hard delete job completed: ${deletedCount} old sessions permanently deleted`,
      );
    } catch (error) {
      this.logger.error(
        `Hard delete job failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
