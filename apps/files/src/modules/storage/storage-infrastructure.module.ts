import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ClamAvDegradationMode, ClamAvSettings } from '../../setup/configuration/clam-av-settings';
import { Configuration } from '../../setup/configuration/configuration';
import { StorageQueueSettings } from '../../setup/configuration/storage-queue-settings';
import { s3ClientProvider } from './infrastructure/object-storage/s3-client.provider';
import { S3ObjectStorageAdapter } from './infrastructure/object-storage/s3-object-storage.adapter';
import { OBJECT_STORAGE_PORT } from './infrastructure/object-storage/object-storage.tokens';
import {
  ClamAvScannerAdapter,
  NoopScannerAdapter,
} from './infrastructure/scanning/clamav-scanner.adapter';
import { VIRUS_SCANNER_PORT } from './infrastructure/scanning/virus-scanner.port';
import {
  AV_PROCESSOR_PORT,
  IMAGE_PROCESSOR_PORT,
} from './infrastructure/processing/media-processor.port';
import { SharpImageProcessorAdapter } from './infrastructure/processing/sharp-image-processor.adapter';
import { FfmpegAvProcessorAdapter } from './infrastructure/processing/ffmpeg-av-processor.adapter';
import { StorageObjectRepository } from './infrastructure/persistence/repositories/storage-object.repository';
import { UploadSessionRepository } from './infrastructure/persistence/repositories/upload-session.repository';
import { StorageOutboxRepository } from './infrastructure/persistence/repositories/storage-outbox.repository';
import { StorageReferenceOperationRepository } from './infrastructure/persistence/repositories/storage-reference-operation.repository';
import { storageRedisProvider } from './infrastructure/queue/storage-redis.provider';
import { STORAGE_QUEUE_NAMES } from './infrastructure/queue/storage-queue.constants';
import { UploadQuotaService } from './application/services/upload-quota.service';
import { StorageMetaMapper } from './application/services/storage-meta.mapper';
import { StorageProfileRegistryProvider } from './application/profiles/storage-profile-registry.provider';
import { StorageProfileRegistryService } from './application/profiles/storage-profile-registry.service';

const virusScannerProvider: Provider = {
  provide: VIRUS_SCANNER_PORT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Configuration, true>) => {
    const settings = configService.get<ClamAvSettings>('clamAvSettings');

    if (settings.degradationMode === ClamAvDegradationMode.Noop) {
      return new NoopScannerAdapter();
    }

    return new ClamAvScannerAdapter(configService);
  },
};

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => ({
        connection: {
          url: configService.get<StorageQueueSettings>('storageQueueSettings').redisUrl,
        },
        prefix: configService.get<StorageQueueSettings>('storageQueueSettings').queuePrefix,
      }),
    }),
    BullModule.registerQueue(
      { name: STORAGE_QUEUE_NAMES.PROCESS_OBJECT },
      { name: STORAGE_QUEUE_NAMES.DELETE_OBJECT },
      { name: STORAGE_QUEUE_NAMES.ABORT_MULTIPART },
    ),
  ],
  providers: [
    s3ClientProvider,
    storageRedisProvider,
    StorageProfileRegistryProvider,
    StorageProfileRegistryService,
    { provide: OBJECT_STORAGE_PORT, useClass: S3ObjectStorageAdapter },
    virusScannerProvider,
    { provide: IMAGE_PROCESSOR_PORT, useClass: SharpImageProcessorAdapter },
    { provide: AV_PROCESSOR_PORT, useClass: FfmpegAvProcessorAdapter },
    StorageObjectRepository,
    UploadSessionRepository,
    StorageOutboxRepository,
    StorageReferenceOperationRepository,
    UploadQuotaService,
    StorageMetaMapper,
  ],
  exports: [
    BullModule,
    OBJECT_STORAGE_PORT,
    VIRUS_SCANNER_PORT,
    IMAGE_PROCESSOR_PORT,
    AV_PROCESSOR_PORT,
    StorageObjectRepository,
    UploadSessionRepository,
    StorageOutboxRepository,
    StorageReferenceOperationRepository,
    UploadQuotaService,
    StorageMetaMapper,
    StorageProfileRegistryProvider,
    StorageProfileRegistryService,
  ],
})
export class StorageInfrastructureModule {}
