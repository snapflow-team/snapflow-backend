import { Module } from '@nestjs/common';
import { PostsMediaController } from './api/posts-media.controller';
import { GeneratedUploadUrlUseCase } from './application/usecases/generate-presignet-url.usecase';
import { ConfirmUploadUseCase } from './application/usecases/comfirm-upload.usecase';
import { StorageService } from './infrastructure/storage/storage.service';
import { FilesRepository } from './infrastructure/repositories/files.repository';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { ValidateFilesUseCase } from './application/usecases/validate-files.usecase';

const controllers = [PostsMediaController];
const useCases = [GeneratedUploadUrlUseCase, ConfirmUploadUseCase, ValidateFilesUseCase];
const services = [StorageService, CryptoService];

@Module({
  imports: [],
  controllers: [...controllers],
  providers: [...useCases, ...services, FilesRepository],
  exports: [],
})
export class MediaModule {}
