import { Module } from '@nestjs/common';
import { StorageProfileRegistryProvider } from './application/profiles/storage-profile-registry.provider';

@Module({
  imports: [],
  providers: [StorageProfileRegistryProvider],
  exports: [StorageProfileRegistryProvider],
})
export class StorageWorkerModule {}
