import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageOutboxEventType } from '@generated/prisma-files';
import { ConfigService } from '@nestjs/config';
import { StorageObjectRepository } from '../../infrastructure/persistence/repositories/storage-object.repository';
import { UploadSessionRepository } from '../../infrastructure/persistence/repositories/upload-session.repository';
import { StorageOutboxRepository } from '../../infrastructure/persistence/repositories/storage-outbox.repository';
import { OBJECT_STORAGE_PORT } from '../../infrastructure/object-storage/object-storage.tokens';
import type { ObjectStoragePort } from '../../infrastructure/object-storage/object-storage.port';
import { Configuration } from '../../../../setup/configuration/configuration';
import { StorageSettings } from '../../../../setup/configuration/storage-settings';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { AV_PROCESSOR_PORT } from '../../infrastructure/processing/media-processor.port';
import type { AvProcessorPort } from '../../infrastructure/processing/media-processor.port';

@Injectable()
export class DeleteObjectService {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort,
  ) {}

  async execute(objectId: string): Promise<void> {
    const row = await this.storageObjectRepository.findByIdWithVariants(objectId);

    if (!row) {
      return;
    }

    for (const variant of row.variants) {
      await this.objectStorage.deleteObject(variant.key).catch(() => undefined);
    }

    const object = await this.storageObjectRepository.findById(objectId);

    if (object) {
      object.markDeleted();
      await this.storageObjectRepository.save(object);
    }
  }
}

@Injectable()
export class SessionReaperService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly uploadSessionRepository: UploadSessionRepository,
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(SessionReaperService.name);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reapExpiredSessions(): Promise<void> {
    const expired = await this.uploadSessionRepository.findExpired(50);

    for (const record of expired) {
      try {
        record.session.abort();

        if (record.multipartId) {
          await this.storageOutboxRepository.createEvent(StorageOutboxEventType.ABORT_MULTIPART, {
            sessionId: record.session.id,
            key: record.storageKey,
            uploadId: record.multipartId,
          });
        }

        await this.storageObjectRepository.deleteById(record.session.objectId);
        await this.uploadSessionRepository.deleteById(record.session.id);
      } catch (error) {
        this.logger.error(error, this.reapExpiredSessions.name);
      }
    }
  }
}

@Injectable()
export class OrphanCleanupService {
  private readonly logger: ContextLogger;
  private readonly orphanTtlSeconds: number;

  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly storageOutboxRepository: StorageOutboxRepository,
    configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(OrphanCleanupService.name);
    this.orphanTtlSeconds = configService.get<StorageSettings>('storageSettings').orphanTtlSeconds;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphans(): Promise<void> {
    const threshold = new Date(Date.now() - this.orphanTtlSeconds * 1000);
    const candidates = await this.storageObjectRepository.findOrphanCandidates(threshold, 100);

    for (const object of candidates) {
      try {
        await this.storageOutboxRepository.createEvent(StorageOutboxEventType.DELETE_OBJECT, {
          objectId: object.id,
          reason: 'orphan_cleanup',
        });
      } catch (error) {
        this.logger.error(error, this.cleanupOrphans.name);
      }
    }
  }
}

@Injectable()
export class AbortMultipartService {
  constructor(@Inject(OBJECT_STORAGE_PORT) private readonly objectStorage: ObjectStoragePort) {}

  async execute(params: { key: string; uploadId: string }): Promise<void> {
    await this.objectStorage.abortMultipartUpload(params.key, params.uploadId);
  }
}

@Injectable()
export class FfmpegHealthService {
  private readonly logger: ContextLogger;

  constructor(
    @Inject(AV_PROCESSOR_PORT) private readonly avProcessor: AvProcessorPort,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(FfmpegHealthService.name);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async verifyBinaries(): Promise<void> {
    const available = await this.avProcessor.isAvailable();

    if (!available) {
      this.logger.warn('ffmpeg/ffprobe binaries are not available', this.verifyBinaries.name);
    }
  }
}
