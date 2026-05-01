import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { File } from '@generated/prisma-files';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { PendingFilesCleanup } from '../constants/pending-files-cleanup.constants';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Injectable()
export class PendingFilesCleanupService {
  private readonly logger: Logger = new Logger(PendingFilesCleanupService.name);
  private isProcessing: boolean = false;

  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

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
            `Failed to check object for pending file ${pendingFile.id}`,
            error instanceof Error ? error.stack : '',
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
      );
    } catch (error) {
      this.logger.error(
        'Failed to cleanup stale pending files',
        error instanceof Error ? error.stack : '',
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
