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
  UploadFileRequest,
  UploadFileResponse,
  ValidateFilesRequest,
  ValidateFilesResponse,
} from '../../../../../../libs/contracts/files';
import { SnapFlowDomainExceptionCodeMapper } from '../../../common/exceptions/snapflow-domain-exception-mapper';

@Injectable()
export class FilesClient {
  constructor(
    @Inject(SERVICES.FILES) private readonly client: ClientProxy,
    private readonly exceptionMapper: SnapFlowDomainExceptionCodeMapper,
  ) {}

  async generateUploadUrl(
    payload: GenerateUploadUrlsRequest,
  ): Promise<GenerateUploadUrlResponse[]> {
    try {
      return firstValueFrom(
        this.client.send<GenerateUploadUrlResponse[]>(
          { cmd: FilesRpcCommand.GenerateUploadUrl },
          payload,
        ),
      );
    } catch (error) {
      if (this.isRpcError(error)) {
        throw this.exceptionMapper.mapRpcToDomainException(error.response);
      }
      throw error;
    }
  }

  async confirmUpload(payload: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
    try {
      return firstValueFrom(
        this.client.send<ConfirmUploadResponse>({ cmd: FilesRpcCommand.ConfirmUpload }, payload),
      );
    } catch (error) {
      if (this.isRpcError(error)) {
        throw this.exceptionMapper.mapRpcToDomainException(error.response);
      }
      throw error;
    }
  }

  async validateFiles(payload: ValidateFilesRequest): Promise<ValidateFilesResponse> {
    try {
      return firstValueFrom(
        this.client.send<ValidateFilesResponse>({ cmd: FilesRpcCommand.ValidateFiles }, payload),
      );
    } catch (error) {
      if (this.isRpcError(error)) {
        throw this.exceptionMapper.mapRpcToDomainException(error.response);
      }
      throw error;
    }
  }

  async uploadFile(payload: UploadFileRequest): Promise<UploadFileResponse> {
    return firstValueFrom(this.client.send({ cmd: FilesRpcCommand.UploadFile }, payload));
  }

  private isRpcError(error: any): boolean {
    return error?.response?.service === 'Files';
  }
}
