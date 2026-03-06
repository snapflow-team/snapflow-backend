import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ConfirmUploadInputDto,
  ConfirmUploadResponse,
  FilesRpcCommand,
  GenerateUploadUrlInputDto,
  GenerateUploadUrlResponse,
  ValidateFilesInputDto,
  ValidateFilesResponse,
} from '../../../../../../../libs/contracts/files';
import { CommandBus } from '@nestjs/cqrs';
import { GeneratedUploadUrlCommand } from '../application/usecases/generate-presignet-url.usecase';
import { ConfirmUploadCommand } from '../application/usecases/comfirm-upload.usecase';
import { ValidateFilesCommand } from '../application/usecases/validate-files.usecase';

@Controller()
export class PostsMediaController {
  constructor(private readonly commandBus: CommandBus) {}

  @MessagePattern({ cmd: FilesRpcCommand.GenerateUploadUrl })
  async generateUploadUrl(
    @Payload()
    data: GenerateUploadUrlInputDto,
  ): Promise<GenerateUploadUrlResponse> {
    return this.commandBus.execute(new GeneratedUploadUrlCommand(data));
  }

  @MessagePattern({ cmd: FilesRpcCommand.ConfirmUpload })
  async confirmUpload(
    @Payload()
    data: ConfirmUploadInputDto,
  ): Promise<ConfirmUploadResponse> {
    await this.commandBus.execute(new ConfirmUploadCommand(data));
    return { success: true };
  }

  @MessagePattern({ cmd: FilesRpcCommand.ValidateFiles })
  async validateFiles(
    @Payload()
    data: ValidateFilesInputDto,
  ): Promise<ValidateFilesResponse> {
    return this.commandBus.execute(new ValidateFilesCommand(data));
  }
}
