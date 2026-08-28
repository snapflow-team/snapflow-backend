import { Module } from '@nestjs/common';
import { StorageIngestModule } from './storage-ingest.module';
import { StorageRpcModule } from './storage-rpc.module';
import { StorageWorkerModule } from './storage-worker.module';

@Module({
  imports: [StorageRpcModule, StorageIngestModule, StorageWorkerModule],
  exports: [StorageRpcModule, StorageIngestModule, StorageWorkerModule],
})
export class StorageModule {}
