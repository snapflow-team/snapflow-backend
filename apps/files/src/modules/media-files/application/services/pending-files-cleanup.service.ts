import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { File } from '@generated/prisma-files';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { PendingFilesCleanup } from '../constants/pending-files-cleanup.constants';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';

@Injectable()
export class PendingFilesCleanupService {
  private readonly logger: ContextLogger;
  private isProcessing: boolean = false;

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(PendingFilesCleanupService.name);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupPendingFiles(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const { presignedExpiresIn } = this.configService.get<S3Settings>('s3Settings');
      const stalePendingThresholdMinutes: number =
        Math.ceil(presignedExpiresIn / 60) +
        PendingFilesCleanup.PENDING_FILES_TTL_SAFETY_BUFFER_MINUTES;

      const recoveredCount: number = await this.filesRepository.recoverStaleProcessing(
        PendingFilesCleanup.PENDING_CLEANUP_STALE_THRESHOLD_MINUTES,
      );

      if (recoveredCount > 0) {
        this.logger.warn(
          `Recovered ${recoveredCount} stale PENDING_CLEANUP files back to PENDING.`,
          this.cleanupPendingFiles.name,
        );
      }

      const stalePendingFiles: File[] = await this.filesRepository.lockStalePendingForCleanup(
        stalePendingThresholdMinutes,
        PendingFilesCleanup.CLEANUP_BATCH_SIZE,
      );

      if (stalePendingFiles.length === 0) {
        return;
      }

      const idsToRecover: string[] = [];
      const idsToDelete: string[] = [];
      const idsToRelease: string[] = [];

      for (const pendingFile of stalePendingFiles) {
        try {
          const objectExists: boolean = await this.storageService.objectExists(pendingFile.key);

          if (objectExists) {
            idsToRecover.push(pendingFile.id);
            continue;
          }

          idsToDelete.push(pendingFile.id);
        } catch (error) {
          idsToRelease.push(pendingFile.id);
          this.logger.error(
            error instanceof Error ? error : new Error(String(error)),
            this.cleanupPendingFiles.name,
          );
        }
      }

      if (idsToRecover.length > 0) {
        await this.filesRepository.confirmManyUploads(idsToRecover);
      }

      if (idsToRelease.length > 0) {
        await this.filesRepository.releaseManyToPending(idsToRelease);
      }

      let deletedCount: number = 0;
      if (idsToDelete.length > 0) {
        deletedCount = await this.filesRepository.deleteByIds(idsToDelete);
      }

      this.logger.log(
        `Pending cleanup finished. recovered=${idsToRecover.length} deleted=${deletedCount} released=${idsToRelease.length} thresholdMinutes=${stalePendingThresholdMinutes}`,
        this.cleanupPendingFiles.name,
      );
    } catch (error) {
      this.logger.error(error, this.cleanupPendingFiles.name);
    } finally {
      this.isProcessing = false;
    }
  }
}
