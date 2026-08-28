import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageInfrastructureModule } from './storage-infrastructure.module';
import { StorageProfileRegistryService } from './application/profiles/storage-profile-registry.service';
import { ProcessObjectService } from './application/services/process-object.service';
import {
  AbortMultipartService,
  DeleteObjectService,
  FfmpegHealthService,
  OrphanCleanupService,
  SessionReaperService,
} from './application/services/lifecycle.services';
import { StorageOutboxRelayService } from './infrastructure/queue/storage-outbox-relay.service';
import {
  AbortMultipartProcessor,
  DeleteObjectProcessor,
  ProcessObjectProcessor,
} from './infrastructure/queue/processors/storage-queue.processors';
import { Configuration } from '../../setup/configuration/configuration';
import { StorageQueueSettings } from '../../setup/configuration/storage-queue-settings';

@Module({
  imports: [StorageInfrastructureModule],
  providers: [
    StorageProfileRegistryService,
    ProcessObjectService,
    DeleteObjectService,
    AbortMultipartService,
    SessionReaperService,
    OrphanCleanupService,
    FfmpegHealthService,
    StorageOutboxRelayService,
    ProcessObjectProcessor,
    DeleteObjectProcessor,
    AbortMultipartProcessor,
    {
      provide: 'STORAGE_WORKER_CONCURRENCY',
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) =>
        configService.get<StorageQueueSettings>('storageQueueSettings'),
    },
  ],
})
export class StorageWorkerModule {}
