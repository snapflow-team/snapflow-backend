import { Module } from '@nestjs/common';
import { PostsMediaController } from './post-media-files/api/posts-media.controller';
import { GeneratedUploadUrlUseCase } from './post-media-files/application/usecases/generate-presignet-url.usecase';
import { ConfirmUploadUseCase } from './post-media-files/application/usecases/comfirm-upload.usecase';
import { StorageService } from './post-media-files/infrastructure/storage/storage.service';
import { FilesRepository } from './post-media-files/infrastructure/repositories/files.repository';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { ValidateFilesUseCase } from './post-media-files/application/usecases/validate-files.usecase';

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
