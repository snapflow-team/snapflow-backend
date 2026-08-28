import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { RpcPayload } from '../../../../../../../libs/common/rpc/rpc-payload.decorator';
import type {
  AttachObjectsRequest,
  AttachObjectsResponse,
  GetObjectsMetaRequest,
  GetObjectsMetaResponse,
  GetSignedUrlsRequest,
  GetSignedUrlsResponse,
  ReleaseObjectsRequest,
  ReleaseObjectsResponse,
  ValidateObjectsRequest,
  ValidateObjectsResponse,
} from '@contracts/storage';
import { StorageRpcCommand } from '@contracts/storage';
import {
  AttachObjectsUseCase,
  GetObjectsMetaUseCase,
  GetSignedUrlsUseCase,
  ReleaseObjectsUseCase,
  ValidateObjectsUseCase,
} from '../../application/usecases/rpc/storage-rpc.usecases';

@Controller()
export class StorageRpcController {
  constructor(
    private readonly validateObjectsUseCase: ValidateObjectsUseCase,
    private readonly attachObjectsUseCase: AttachObjectsUseCase,
    private readonly releaseObjectsUseCase: ReleaseObjectsUseCase,
    private readonly getObjectsMetaUseCase: GetObjectsMetaUseCase,
    private readonly getSignedUrlsUseCase: GetSignedUrlsUseCase,
  ) {}

  @MessagePattern({ cmd: StorageRpcCommand.ValidateObjects })
  validateObjects(@RpcPayload() data: ValidateObjectsRequest): Promise<ValidateObjectsResponse> {
    return this.validateObjectsUseCase.execute(data);
  }

  @MessagePattern({ cmd: StorageRpcCommand.AttachObjects })
  attachObjects(@RpcPayload() data: AttachObjectsRequest): Promise<AttachObjectsResponse> {
    return this.attachObjectsUseCase.execute(data);
  }

  @MessagePattern({ cmd: StorageRpcCommand.ReleaseObjects })
  releaseObjects(@RpcPayload() data: ReleaseObjectsRequest): Promise<ReleaseObjectsResponse> {
    return this.releaseObjectsUseCase.execute(data);
  }

  @MessagePattern({ cmd: StorageRpcCommand.GetObjectsMeta })
  getObjectsMeta(@RpcPayload() data: GetObjectsMetaRequest): Promise<GetObjectsMetaResponse> {
    return this.getObjectsMetaUseCase.execute(data);
  }

  @MessagePattern({ cmd: StorageRpcCommand.GetSignedUrls })
  getSignedUrls(@RpcPayload() data: GetSignedUrlsRequest): Promise<GetSignedUrlsResponse> {
    return this.getSignedUrlsUseCase.execute(data);
  }
}
