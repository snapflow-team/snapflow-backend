import { Inject, Injectable } from '@nestjs/common';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GenerateUploadUrlResponse } from '../../../../../../libs/contracts/files/generate-upload-url.contract';
import { ConfirmUploadResponse } from '../../../../../../libs/contracts/files/confirm-upload.contract';
import { ValidateFilesResponse } from '../../../../../../libs/contracts/files/validate-files.contract';

@Injectable()
export class FilesClient {
  constructor(@Inject(SERVICES.FILES) private readonly client: ClientProxy) {}

  async generateUploadUrl(
    userId: number,
    mimeType: string,
    size: number,
  ): Promise<GenerateUploadUrlResponse> {
    return firstValueFrom(
      this.client.send<GenerateUploadUrlResponse>(
        { cmd: 'generate_upload_url' },
        { userId, mimeType, size },
      ),
    );
  }

  async confirmUpload(userId: number, fileId: string) {
    return firstValueFrom(
      this.client.send<ConfirmUploadResponse>({ cmd: 'confirm_upload' }, { userId, fileId }),
    );
  }

  async validateFiles(userId: number, fileIds: string[]) {
    return firstValueFrom(
      this.client.send<ValidateFilesResponse>({ cmd: 'validate_files' }, { userId, fileIds }),
    );
  }
}
