import { Module } from '@nestjs/common';
import { StorageInfrastructureModule } from './storage-infrastructure.module';
import { StorageJwtAuthModule } from './api/http/auth/storage-jwt-auth.module';
import { StorageProfileRegistryService } from './application/profiles/storage-profile-registry.service';
import { MimeSnifferService } from './api/http/services/mime-sniffer.service';
import {
  AbortResumableUploadUseCase,
  CompleteResumableUploadUseCase,
  CreateResumableUploadUseCase,
  DirectUploadUseCase,
  GetObjectStatusUseCase,
  GetUploadSessionUseCase,
  PatchResumableUploadUseCase,
} from './application/usecases/ingest/upload.usecases';
import {
  StorageUploadController,
  StorageObjectController,
} from './api/http/controllers/storage-upload.controller';

@Module({
  imports: [StorageInfrastructureModule, StorageJwtAuthModule],
  controllers: [StorageUploadController, StorageObjectController],
  providers: [
    StorageProfileRegistryService,
    MimeSnifferService,
    DirectUploadUseCase,
    CreateResumableUploadUseCase,
    PatchResumableUploadUseCase,
    CompleteResumableUploadUseCase,
    AbortResumableUploadUseCase,
    GetUploadSessionUseCase,
    GetObjectStatusUseCase,
  ],
})
export class StorageIngestModule {}
