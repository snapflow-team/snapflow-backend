import { Inject, Injectable } from '@nestjs/common';
import { SERVICES } from '../../../../../../libs/contracts/services.tokens';
import { ClientProxy } from '@nestjs/microservices';
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
import { RpcCaller } from '../../../../../../libs/exceptions/rpc/rpc-caller';

@Injectable()
export class FilesClient {
  private readonly rpcCaller: RpcCaller;

  constructor(
    @Inject(SERVICES.FILES) private readonly client: ClientProxy,
    exceptionMapper: SnapFlowDomainExceptionCodeMapper,
  ) {
    this.rpcCaller = new RpcCaller(exceptionMapper);
  }

  async generateUploadUrl(
    payload: GenerateUploadUrlsRequest,
  ): Promise<GenerateUploadUrlResponse[]> {
    return this.rpcCaller.send<GenerateUploadUrlResponse[], GenerateUploadUrlsRequest>(
      this.client,
      { cmd: FilesRpcCommand.GenerateUploadUrl },
      payload,
      { serviceName: SERVICES.FILES },
    );
  }

  async confirmUpload(payload: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
    return this.rpcCaller.send<ConfirmUploadResponse, ConfirmUploadRequest>(
      this.client,
      { cmd: FilesRpcCommand.ConfirmUpload },
      payload,
      { serviceName: SERVICES.FILES },
    );
  }

  async validateFiles(payload: ValidateFilesRequest): Promise<ValidateFilesResponse> {
    return this.rpcCaller.send<ValidateFilesResponse, ValidateFilesRequest>(
      this.client,
      { cmd: FilesRpcCommand.ValidateFiles },
      payload,
      { serviceName: SERVICES.FILES },
    );
  }

  async uploadFile(payload: UploadFileRequest): Promise<UploadFileResponse> {
    return this.rpcCaller.send<UploadFileResponse, UploadFileRequest>(
      this.client,
      { cmd: FilesRpcCommand.UploadFile },
      payload,
      { serviceName: SERVICES.FILES },
    );
  }

  async deleteFile(data: DeleteFileRequest): Promise<DeleteFileResponse> {
    return this.rpcCaller.send<DeleteFileResponse, DeleteFileRequest>(
      this.client,
      { cmd: FilesRpcCommand.DeleteFile },
      data,
      { serviceName: SERVICES.FILES },
    );
  }
}
