import { Inject, Injectable } from '@nestjs/common';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import {
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  DeleteFileRequest,
  DeleteFileResponse,
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
  // vilyamz: прочитать про firstValueFrom
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
        throw this.exceptionMapper.mapRpcToDomainException(error);
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
        throw this.exceptionMapper.mapRpcToDomainException(error);
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
        throw this.exceptionMapper.mapRpcToDomainException(error);
      }
      throw error;
    }
  }

  async uploadFile(payload: UploadFileRequest): Promise<UploadFileResponse> {
    try {
      return firstValueFrom<UploadFileResponse>(
        this.client.send({ cmd: FilesRpcCommand.UploadFile }, payload),
      );
    } catch (error) {
      if (this.isRpcError(error)) {
        throw this.exceptionMapper.mapRpcToDomainException(error);
      }
      throw error;
    }
  }

  async deleteFile(data: DeleteFileRequest): Promise<DeleteFileResponse> {
    try {
      return await lastValueFrom(this.client.send({ cmd: FilesRpcCommand.DeleteFile }, data));
    } catch (error) {
      if (this.isRpcError(error)) {
        throw this.exceptionMapper.mapRpcToDomainException(error);
      }
      throw error;
    }
  }

  private isRpcError(error: any): boolean {
    return error?.service === SERVICES.FILES;
  }
}
