import { Module } from '@nestjs/common';
import { StorageJwtAuthModule } from './api/http/auth/storage-jwt-auth.module';
import { StorageProfileRegistryProvider } from './application/profiles/storage-profile-registry.provider';

@Module({
  imports: [StorageJwtAuthModule],
  providers: [StorageProfileRegistryProvider],
  exports: [StorageJwtAuthModule, StorageProfileRegistryProvider],
})
export class StorageIngestModule {}
