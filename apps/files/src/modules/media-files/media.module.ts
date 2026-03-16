import { Module } from '@nestjs/common';
import { MediaController } from './api/media.controller';
import { GeneratedUploadUrlUseCase } from './application/usecases/generate-presignet-url.usecase';
import { ConfirmUploadUseCase } from './application/usecases/comfirm-upload.usecase';
import { StorageService } from './infrastructure/storage/storage.service';
import { FilesRepository } from './infrastructure/repositories/files.repository';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { ValidateFilesUseCase } from './application/usecases/validate-files.usecase';
import { UploadAvatarUseCase } from './application/usecases/upload-avatar.usecase';
import { DeleteFileUseCase } from './application/usecases/delete-file.usecase';

const controllers = [MediaController];
const useCases = [
  GeneratedUploadUrlUseCase,
  ConfirmUploadUseCase,
  ValidateFilesUseCase,
  UploadAvatarUseCase,
  DeleteFileUseCase,
];
const services = [StorageService, CryptoService];

@Module({
  imports: [],
  controllers: [...controllers],
  providers: [...useCases, ...services, FilesRepository],
  exports: [],
})
export class MediaModule {}
