import { Controller } from '@nestjs/common';
import { PostsMediaService } from '../application/services/posts-media.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ConfirmUploadInputDto,
  FilesRpcCommand,
  GenerateUploadUrlInputDto,
  GenerateUploadUrlResponse,
  ValidateFilesInputDto,
} from '../../../../../../../libs/contracts/files';
import { CommandBus } from '@nestjs/cqrs';
import { GeneratedUploadUrlCommand } from '../application/usecases/generate-presignet-url.usecase';
import { ConfirmUploadCommand } from '../application/usecases/comfirm-upload.usecase';

@Controller()
export class PostsMediaController {
  constructor(
    private readonly filesService: PostsMediaService,
    private readonly commandBus: CommandBus,
  ) {}

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
  ) {
    await this.commandBus.execute(new ConfirmUploadCommand(data));
    return { success: true };
  }

  @MessagePattern({ cmd: FilesRpcCommand.ValidateFiles })
  async validateFiles(
    @Payload()
    data: ValidateFilesInputDto,
  ) {
    return this.filesService.validateFilesForPost(data.userId, data.fileIds);
  }
}
