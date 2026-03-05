import { Inject, Injectable } from '@nestjs/common';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  GenerateUploadUrlRequest,
  GenerateUploadUrlResponse,
} from '../../../../../../libs/contracts/files/generate-upload-url.contract';
import {
  ConfirmUploadRequest,
  ConfirmUploadResponse,
} from '../../../../../../libs/contracts/files/confirm-upload.contract';
import {
  ValidateFilesRequest,
  ValidateFilesResponse,
} from '../../../../../../libs/contracts/files/validate-files.contract';

@Injectable()
export class FilesClient {
  constructor(@Inject(SERVICES.FILES) private readonly client: ClientProxy) {}

  async generateUploadUrl(payload: GenerateUploadUrlRequest): Promise<GenerateUploadUrlResponse> {
    return firstValueFrom(
      this.client.send<GenerateUploadUrlResponse>({ cmd: 'generate_upload_url' }, payload),
    );
  }

  async confirmUpload(payload: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
    return firstValueFrom(
      this.client.send<ConfirmUploadResponse>({ cmd: 'confirm_upload' }, payload),
    );
  }

  async validateFiles(payload: ValidateFilesRequest): Promise<ValidateFilesResponse> {
    return firstValueFrom(
      this.client.send<ValidateFilesResponse>({ cmd: 'validate_files' }, payload),
    );
  }
}
