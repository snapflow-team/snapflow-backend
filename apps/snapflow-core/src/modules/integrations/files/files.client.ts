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
import { FilesRpcCommand } from '../../../../../../libs/contracts/files/files-rpc-commands';

@Injectable()
export class FilesClient {
  constructor(@Inject(SERVICES.FILES) private readonly client: ClientProxy) {}

  async generateUploadUrl(payload: GenerateUploadUrlRequest): Promise<GenerateUploadUrlResponse> {
    return firstValueFrom(
      this.client.send<GenerateUploadUrlResponse>(
        { cmd: FilesRpcCommand.GenerateUploadUrl },
        payload,
      ),
    );
  }

  async confirmUpload(payload: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
    return firstValueFrom(
      this.client.send<ConfirmUploadResponse>({ cmd: FilesRpcCommand.ConfirmUpload }, payload),
    );
  }

  async validateFiles(payload: ValidateFilesRequest): Promise<ValidateFilesResponse> {
    return firstValueFrom(
      this.client.send<ValidateFilesResponse>({ cmd: FilesRpcCommand.ValidateFiles }, payload),
    );
  }
}
