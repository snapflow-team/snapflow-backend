import { Module } from '@nestjs/common';
import { StorageInfrastructureModule } from './storage-infrastructure.module';
import { StorageRpcController } from './api/rpc/storage-rpc.controller';
import { StorageProfileRegistryService } from './application/profiles/storage-profile-registry.service';
import {
  AttachObjectsUseCase,
  GetObjectsMetaUseCase,
  GetSignedUrlsUseCase,
  ReleaseObjectsUseCase,
  ValidateObjectsUseCase,
} from './application/usecases/rpc/storage-rpc.usecases';

@Module({
  imports: [StorageInfrastructureModule],
  controllers: [StorageRpcController],
  providers: [
    StorageProfileRegistryService,
    ValidateObjectsUseCase,
    AttachObjectsUseCase,
    ReleaseObjectsUseCase,
    GetObjectsMetaUseCase,
    GetSignedUrlsUseCase,
  ],
})
export class StorageRpcModule {}
