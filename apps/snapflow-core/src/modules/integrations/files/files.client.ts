import { Inject, Injectable } from '@nestjs/common';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  FilesRpcCommand,
  GenerateUploadUrlResponse,
  GenerateUploadUrlsRequest,
  ValidateFilesRequest,
  ValidateFilesResponse,
} from '../../../../../../libs/contracts/files';

@Injectable()
export class FilesClient {
  constructor(@Inject(SERVICES.FILES) private readonly client: ClientProxy) {}

  async generateUploadUrl(
    payload: GenerateUploadUrlsRequest,
  ): Promise<GenerateUploadUrlResponse[]> {
    return firstValueFrom(
      this.client.send<GenerateUploadUrlResponse[]>(
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
